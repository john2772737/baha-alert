#include <SoftwareSerial.h>
#include <avr/sleep.h> 

// --- NEW EEPROM CODE: Library & Storage Structure ---
#include <EEPROM.h>

struct WifiCredentials {
  char ssid[32];     // Space for 32 characters
  char password[32]; // Space for 32 characters
};
WifiCredentials creds;
// ----------------------------------------------------

// --- 1. SENSOR LIBRARIES ---
#include "BMP180.h" 
#include "RainSensor.h" 
#include "SoilMoisture.h" 
#include "Ultrasonic.h" 

// --- 2. SYSTEM MODES ---
enum SystemState {
  AUTO_MODE,
  MAINTENANCE_MODE,
  SLEEP_MODE
};

volatile SystemState currentState = AUTO_MODE;

// --- 3. PINS ---
const int BUTTON_PIN = 2;       
const int ESP_RX = 4;           
const int ESP_TX = 5;           
SoftwareSerial espSerial(ESP_RX, ESP_TX); 

// --- 4. SENSORS ---
BMP180 bmpsensor;
RainSensor rainsensor(A2); 
SoilMoisture soilmoisture(A3);
Ultrasonic ultrasonic(6, 7);

// --- 5. TIMERS ---
unsigned long previousMillis = 0;
const long INTERVAL = 2000;    

// --- FUNCTION PROTOTYPES (For EEPROM Helpers) ---
void loadWifiCredentials();
void saveWifiCredentials(String s, String p);

void setup() {
  Serial.begin(9600);     
  espSerial.begin(9600);  
  
  Serial.println("Initializing Sensors...");
  bmpsensor.begin();
  rainsensor.begin();
  soilmoisture.begin(); 
  ultrasonic.begin();   

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println("System Started: AUTO MODE");
  Serial.println("Press Button to switch modes.");

  // --- NEW EEPROM CODE: Load Wi-Fi on Startup ---
  delay(1000); // Wait for ESP to boot
  loadWifiCredentials(); // Read memory and send to ESP
  // ----------------------------------------------
}

void loop() {
  switch (currentState) {
    case AUTO_MODE:
      runAutoMode();
      break;
    case MAINTENANCE_MODE:
      runMaintenanceMode();
      break;
    case SLEEP_MODE:
      runSleepMode();
      break;
  }
}

// ==========================================
//           MODE FUNCTIONS
// ==========================================

void runAutoMode() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= INTERVAL) {
    previousMillis = currentMillis;

    float pressure = bmpsensor.getPressureHPA();
    String rainCond = rainsensor.getCondition();
    String soilCond = soilmoisture.getCondition();
    String waterLevelCond = ultrasonic.getCondition();

    String data;
    data.reserve(200); 
    data = "{\"mode\":\"AUTO\","; 
    data += "\"pressure\":"; data += String(pressure);
    data += ",\"rain\":\""; data += rainCond; data += "\"";
    data += ",\"waterLevel\":\""; data += waterLevelCond; data += "\"";
    data += ",\"soil\":\""; data += soilCond; data += "\"}"; 

    espSerial.println(data); 
    Serial.println("AUTO LOG: " + data); 
  }
}
 // ==========================================
//           MODE FUNCTIONS
// ==========================================

void runMaintenanceMode() {
  char cmd = 0;
  
  // 1. Check for incoming commands from Serial (USB) or espSerial (ESP module)
  if (Serial.available() > 0) {
    cmd = Serial.read();
  } else if (espSerial.available() > 0) {
    cmd = espSerial.read();
  }

  // 2. Input Filtering: Ignore common control/whitespace characters
  if (cmd == 0 || cmd == '\n' || cmd == '\r' || cmd == ' ') {
    return; 
  }
  
  if (cmd != 0) {
    // 3. Rate Limiting to prevent rapid-fire commands
    static char lastCmd = 0;
    static unsigned long lastCmdTime = 0;
    // Check if the same command was sent too quickly (less than 1000ms ago)
    if (cmd == lastCmd && millis() - lastCmdTime < 1000) return;
    
    lastCmd = cmd;
    lastCmdTime = millis();

    Serial.print("CMD RECEIVED: "); Serial.println(cmd);

    switch (cmd) {
      case 'U': case 'u': 
        {
          String val = ultrasonic.getCondition();
          Serial.print("WATER: "); Serial.println(val);
          espSerial.println("{\"sensor\":\"water\",\"val\":\"" + val + "\"}");
        } break;

      case 'R': case 'r': 
        {
          String val = rainsensor.getCondition();
          Serial.print("RAIN: "); Serial.println(val);
          espSerial.println("{\"sensor\":\"rain\",\"val\":\"" + val + "\"}");
        } break;

      case 'S': case 's': 
        {
          String val = soilmoisture.getCondition();
          Serial.print("SOIL: "); Serial.println(val);
          espSerial.println("{\"sensor\":\"soil\",\"val\":\"" + val + "\"}");
        } break;

      case 'P': case 'p': 
        {
          float val = bmpsensor.getPressureHPA();
          Serial.print("PRESSURE: "); Serial.println(val);
          espSerial.println("{\"sensor\":\"pressure\",\"val\":" + String(val) + "}");
        } break;

      case 'L': case 'l': 
        digitalWrite(13, !digitalRead(13)); 
        Serial.println("LED Toggled");
        espSerial.println("{\"sensor\":\"led\",\"val\":\"toggled\"}");
        break;

      // --- EEPROM CODE: The 'W' Command for Wi-Fi Setup (The fixed part) ---
      case 'W': case 'w':
        Serial.println("=== WI-FI SETUP ===");
        Serial.println("Type your Wi-Fi details in this format:");
        Serial.println("**SSID,PASSWORD**");
        
        // --- CRITICAL FIX: Clear the buffer fully before waiting for new input ---
        // This consumes any stray \n, \r, or spaces left after the 'w' command, 
        // preventing the "Error: Missing comma" message from being triggered immediately.
        while (Serial.available()) {
          Serial.read();
          delay(2); // Small delay aids buffer flushing on some boards
        }
        
        Serial.println("Waiting for input...");
        
        // Wait for user to type (Blocking is okay in Maintenance Mode)
        unsigned long startTime = millis();
        const long TIMEOUT = 30000; // 30 seconds timeout
        
        while(Serial.available() == 0 && (millis() - startTime < TIMEOUT)) {
          // Check button just in case user wants to exit
          if(digitalRead(BUTTON_PIN) == LOW) {
            Serial.println("Wi-Fi setup aborted by button press.");
            return; 
          }
          delay(10);
        }

        if (Serial.available() == 0) {
          Serial.println("Wi-Fi setup timed out (30s).");
          return;
        }
        
        // Read the full line of input
        String input = Serial.readStringUntil('\n');
        input.trim(); // Remove leading/trailing whitespace (e.g., if the user put a space after the comma)
        
        // Double-check: Clear any remaining bytes that might be in the buffer after the read
        while (Serial.available()) {
            Serial.read();
        }
        
        int commaIndex = input.indexOf(',');
        if (commaIndex > 0) {
          String newSSID = input.substring(0, commaIndex);
          String newPass = input.substring(commaIndex + 1);
          
          // Safety check for length against the 32-byte char arrays
          if (newSSID.length() >= 32 || newPass.length() >= 32) {
             Serial.println("Error: SSID or Password too long (max 31 chars).");
          } else {
             Serial.print("Saving: " + newSSID);
             saveWifiCredentials(newSSID, newPass);
          }
        } else {
          // This should only trigger if the user typed text without a comma
          Serial.println("Error: Missing comma. Format: ssid,pass");
        }
        break;
      // ----------------------------------------

      default: 
        Serial.println("Unknown Command"); 
        break;
    }
  }
}

void runSleepMode() {
  Serial.println("System Sleeping... (Press Button to Wake)");
  Serial.flush(); 
  
  espSerial.println("{\"mode\":\"SLEEP\"}");

  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  
  sleep_mode(); 
  
  sleep_disable(); 
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN)); 
  
  currentState = AUTO_MODE; 
  Serial.println("Woke up!");

  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

void changeModeISR() {
  static unsigned long last_interrupt_time = 0;
  unsigned long interrupt_time = millis();
  
  if (interrupt_time - last_interrupt_time > 200) {
    currentState = (SystemState)((currentState + 1) % 3);
  }
  last_interrupt_time = interrupt_time;
}

// ==========================================
//    NEW HELPER FUNCTIONS FOR EEPROM
// ==========================================

void loadWifiCredentials() {
  EEPROM.get(0, creds); // Read from Address 0
  
  // Check if EEPROM is empty (New Arduino)
  if (creds.ssid[0] == 0 || creds.ssid[0] == 0xFF) {
    Serial.println("EEPROM: No Wi-Fi found. Please set in Maintenance Mode.");
  } else {
    Serial.print("EEPROM: Loading Wi-Fi: ");
    Serial.println(creds.ssid);
    
    // Send Config to ESP
    // Format: {"type":"config","ssid":"Name","pass":"123"}
    String config = "{\"type\":\"config\",\"ssid\":\"" + String(creds.ssid) + "\",\"pass\":\"" + String(creds.password) + "\"}";
    espSerial.println(config);
  }
}

void saveWifiCredentials(String newSSID, String newPass) {
  // Clear old data
  memset(creds.ssid, 0, 32);
  memset(creds.password, 0, 32);
  
  // Copy new Strings to Char Arrays
  newSSID.toCharArray(creds.ssid, 32);
  newPass.toCharArray(creds.password, 32);
  
  // Write to EEPROM
  EEPROM.put(0, creds);
  Serial.println(" -> Saved to Memory!");
  
  // Send to ESP immediately
  loadWifiCredentials();
}
#include <SoftwareSerial.h>
#include <avr/sleep.h> 

// --- EEPROM CODE: Library & Storage Structure ---
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
// 🌟 NEW: Flag to signal an immediate mode change status update is needed
volatile bool modeChangeFlag = false; 

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
void runAutoMode();
void runMaintenanceMode();
void runSleepMode();
void changeModeISR();
void sendModeStatus(); // 🌟 NEW: Prototype for the status function


void setup() {
  Serial.begin(9600);     
  espSerial.begin(9600);  
  
  Serial.println(F("Initializing Sensors..."));
  
  // Note: If any sensor initialization fails (e.g., BMP180), the code may stop here.
  // Ensure all sensor libraries (BMP180.h, RainSensor.h, etc.) are installed and working.
  bmpsensor.begin();
  rainsensor.begin();
  soilmoisture.begin(); 
  ultrasonic.begin();   

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  Serial.println(F("Press Button to switch modes."));

  // 🌟 FIX: Ensure startup messages are fully printed before loop starts
  Serial.flush(); 

  // --- NEW EEPROM CODE: Load Wi-Fi on Startup ---
  delay(1000); // Wait for ESP to boot
  loadWifiCredentials(); // Read memory and send to ESP
  // ----------------------------------------------
}

void loop() {
  
  // 🌟 NEW LOGIC: Check and send immediate mode change status 🌟
  if (modeChangeFlag) {
    sendModeStatus();
    modeChangeFlag = false; // Reset the flag after sending
  }
  // -----------------------------------------------------------

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

    // 🌟 CHANGE: All readings are now numerical (float/int)
    float pressure = bmpsensor.getPressureHPA();
    // Assuming getRainValue() returns raw analog or scaled voltage (0-1023 or 0.0-5.0)
    int rainValue = rainsensor.getAnalog(); 
    // Assuming getMoistureValue() returns raw analog or percentage (0-1023 or 0-100)
    int soilValue = soilmoisture.getAnalog(); 
    // Assuming getDistanceCM() returns distance in centimeters
    float waterDistanceCM = ultrasonic.getDistanceCM(); 

    // 🌟 STATUS CHECK: If BMP reading is wildly off (0 is a common failure value), skip transmission
    if (pressure < 1.0) {
        Serial.println(F("AUTO LOG: Pressure read failed. Skipping upload."));
        return;
    }

    String data;
    data.reserve(256); // Increased reserve size for robustness
    // Using F() macro for constant strings saves RAM
    data = F("{\"mode\":\"AUTO\","); 
    data += F("\"pressure\":"); data += String(pressure, 2); // 2 decimal places for pressure
    data += F(",\"rain\":"); data += String(rainValue); 
    data += F(",\"soil\":"); data += String(soilValue); 
    data += F(",\"waterDistanceCM\":"); data += String(waterDistanceCM, 1); // 1 decimal place for distance
    data += F("}"); 

    espSerial.println(data); 
    // 🌟 FIX: Flush the serial buffer to ensure the entire JSON is transmitted immediately and completely
    espSerial.flush();
    
    // 🌟 FIX for Ambiguous Operator Error: Use separate print calls instead of String concatenation
    Serial.print(F("AUTO LOG: ")); 
    Serial.println(data); 
  }
}

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

    Serial.print(F("CMD RECEIVED: ")); Serial.println(cmd);

    switch (cmd) {
      case 'U': case 'u': 
        {
          // 🌟 CHANGE: Get distance in CM
          float val = ultrasonic.getDistanceCM();
          Serial.print(F("WATER (CM): ")); Serial.println(val);
          // Send as JSON number, not a string
          espSerial.println("{\"sensor\":\"waterDistanceCM\",\"val\":" + String(val, 1) + "}");
        } break;

      case 'R': case 'r': 
        {
          // 🌟 CHANGE: Get raw rain sensor value
          int val = rainsensor.getAnalog();
          Serial.print(F("RAIN (RAW): ")); Serial.println(val);
          // Send as JSON number
          espSerial.println("{\"sensor\":\"rainRaw\",\"val\":" + String(val) + "}");
        } break;

      case 'S': case 's': 
        {
          // 🌟 CHANGE: Get raw soil moisture value
          int val = soilmoisture.getAnalog();
          Serial.print(F("SOIL (RAW): ")); Serial.println(val);
          // Send as JSON number
          espSerial.println("{\"sensor\":\"soilRaw\",\"val\":" + String(val) + "}");
        } break;

      case 'P': case 'p': 
        {
          // Pressure remains numerical, but we standardize the JSON format
          float val = bmpsensor.getPressureHPA();
          Serial.print(F("PRESSURE (hPA): ")); Serial.println(val);
          // Send as JSON number
          espSerial.println("{\"sensor\":\"pressureHPA\",\"val\":" + String(val, 2) + "}");
        } break;

      case 'L': case 'l': 
        digitalWrite(13, !digitalRead(13)); 
        Serial.println(F("LED Toggled"));
        espSerial.println("{\"sensor\":\"led\",\"val\":\"toggled\"}");
        break;

      // --- EEPROM CODE: The 'W' Command for Wi-Fi Setup (No changes needed here) ---
      case 'W': case 'w':
        Serial.println(F("=== WI-FI SETUP ==="));
        Serial.println(F("Type your Wi-Fi details in this format:"));
        Serial.println(F("**SSID,PASSWORD**"));
        
        // --- CRITICAL FIX: Clear the buffer fully before waiting for new input ---
        while (Serial.available()) {
          Serial.read();
          delay(2);
        }
        
        Serial.println(F("Waiting for input..."));
        
        unsigned long startTime = millis();
        const long TIMEOUT = 30000; // 30 seconds timeout
        
        while(Serial.available() == 0 && (millis() - startTime < TIMEOUT)) {
          if(digitalRead(BUTTON_PIN) == LOW) {
            Serial.println(F("Wi-Fi setup aborted by button press."));
            return; 
          }
          delay(10);
        }

        if (Serial.available() == 0) {
          Serial.println(F("Wi-Fi setup timed out (30s)."));
          return;
        }
        
        String input = Serial.readStringUntil('\n');
        input.trim();
        
        while (Serial.available()) {
            Serial.read();
        }
        
        int commaIndex = input.indexOf(',');
        if (commaIndex > 0) {
          String newSSID = input.substring(0, commaIndex);
          String newPass = input.substring(commaIndex + 1);
          
          if (newSSID.length() >= 32 || newPass.length() >= 32) {
             Serial.println(F("Error: SSID or Password too long (max 31 chars)."));
          } else {
             Serial.print(F("Saving: ")); Serial.println(newSSID);
             saveWifiCredentials(newSSID, newPass);
          }
        } else {
          Serial.println(F("Error: Missing comma. Format: ssid,pass"));
        }
        break;
      // ----------------------------------------

      default: 
        Serial.println(F("Unknown Command")); 
        break;
    }
  }
}

void runSleepMode() {
  Serial.println(F("System Sleeping... (Press Button to Wake)"));
  Serial.flush(); 
  
  // 🌟 NOTE: The sleep status is now sent immediately upon entering the mode 
  // via the sendModeStatus() function, before the microcontroller enters deep sleep.

  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  
  sleep_mode(); 
  
  sleep_disable(); 
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN)); 
  
  currentState = AUTO_MODE; 
  Serial.println(F("Woke up! Returning to AUTO MODE."));

  // 🌟 NEW: Set flag to immediately notify ESP of mode change back to AUTO
  modeChangeFlag = true;

  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}


// ==========================================
//    INTERRUPT and STATUS FUNCTIONS
// ==========================================

// 🌟 NEW: Function to send the current mode status to the ESP32
void sendModeStatus() {
  String modeString;
  switch (currentState) {
    case AUTO_MODE:
      modeString = "AUTO";
      break;
    case MAINTENANCE_MODE:
      modeString = "MAINTENANCE";
      break;
    case SLEEP_MODE:
      modeString = "SLEEP";
      break;
  }
  
  String data = "{\"mode\":\"" + modeString + "\"}";
  espSerial.println(data);
  espSerial.flush();
  
  Serial.print(F("STATUS SENT: Mode changed to "));
  Serial.println(modeString);
}


void changeModeISR() {
  static unsigned long last_interrupt_time = 0;
  unsigned long interrupt_time = millis();
  
  if (interrupt_time - last_interrupt_time > 200) {
    currentState = (SystemState)((currentState + 1) % 3);
    // 🌟 CHANGE: Set the flag to trigger an immediate status send in loop()
    modeChangeFlag = true; 
  }
  last_interrupt_time = interrupt_time;
}

// ==========================================
//    HELPER FUNCTIONS FOR EEPROM
// ==========================================

void loadWifiCredentials() {
  EEPROM.get(0, creds); // Read from Address 0
  
  if (creds.ssid[0] == 0 || creds.ssid[0] == 0xFF) {
    Serial.println(F("EEPROM: No Wi-Fi found. Please set in Maintenance Mode."));
  } else {
    Serial.print(F("EEPROM: Loading Wi-Fi: "));
    Serial.println(creds.ssid);
    
    String config = "{\"type\":\"config\",\"ssid\":\"" + String(creds.ssid) + "\",\"pass\":\"" + String(creds.password) + "\"}";
    espSerial.println(config);
  }
}

void saveWifiCredentials(String newSSID, String newPass) {
  memset(creds.ssid, 0, 32);
  memset(creds.password, 0, 32);
  
  newSSID.toCharArray(creds.ssid, 32);
  newPass.toCharArray(creds.password, 32);
  
  EEPROM.put(0, creds);
  Serial.println(F(" -> Saved to Memory!"));
  
  loadWifiCredentials();
}
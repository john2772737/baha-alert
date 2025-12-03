#include <avr/sleep.h> 

// --- 1. INCLUDE CUSTOM LIBRARIES ---
// Make sure Sensor.h, Sensor.cpp, Communication.h, Communication.cpp, 
// WifiConfig.h, and WifiConfig.cpp are in your project folder.
#include "Sensor.h" 
#include "Communication.h"
#include "WifiConfig.h"

// --- 2. SYSTEM MODES ---
enum SystemState {
  AUTO_MODE,
  MAINTENANCE_MODE,
  SLEEP_MODE
};

volatile SystemState currentState = AUTO_MODE;
volatile bool modeChangeFlag = false; 

// --- 3. HANDSHAKE & CONNECTION FLAGS ---
bool isWifiConnected = false;        
unsigned long lastWifiConfigSent = 0; 
bool configSentInAttempt = false; 

// --- 4. OBJECT INITIALIZATION ---

// Initialize Communication (RX=4, TX=5)
Communication comms(4, 5);

// Initialize Sensor (Trig=6, Echo=7, Soil=A3, Rain=A2)
Sensor mySensor(6, 7, A3, A2);

// Initialize WiFi Storage (EEPROM Manager)
WifiConfig wifiStore;

// --- 5. TIMERS & PINS ---
const int BUTTON_PIN = 2; 
unsigned long previousMillis = 0;
const long INTERVAL = 2000;    
const long RESEND_INTERVAL = 3000; 

// --- FUNCTION PROTOTYPES ---
void loadWifiCredentials();
void saveWifiCredentials(String s, String p);
void runAutoMode();
void runMaintenanceMode();
void runSleepMode();
void changeModeISR();
void updateConnectionStatus(); 

void setup() {
  // 1. Start Hardware Serial (for PC debugging)
  Serial.begin(9600);     
  
  // 2. Start Software Serial (for ESP communication)
  comms.begin(9600);
  
  Serial.println(F("Initializing System..."));
  
  // 3. Start Sensors
  mySensor.begin();
  mySensor.BMP180(); // Initialize I2C BMP sensor

  // 4. Setup Interrupt Button
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  delay(1000); 
}

void loop() {
  delay(10); // Small delay for software serial stability
  
  // 1. Check for incoming status messages from ESP (CONN_OK, etc.)
  updateConnectionStatus();
  
  // 2. Report Mode Changes to ESP if button was pressed
  if (modeChangeFlag) {
    String modeName = (currentState == AUTO_MODE) ? "AUTO" : 
                      (currentState == MAINTENANCE_MODE) ? "MAINTENANCE" : "SLEEP";
    comms.sendMode(modeName);
    modeChangeFlag = false; 
  }

  // 3. Connection Handshake Logic (Blocks Auto Mode until connected)
  if (!isWifiConnected) {
      if (!configSentInAttempt) {
          Serial.println(F("[HANDSHAKE] Sending Credentials..."));
          loadWifiCredentials(); 
          lastWifiConfigSent = millis();
          configSentInAttempt = true; 
      } else if (millis() - lastWifiConfigSent > RESEND_INTERVAL) { 
          Serial.println(F("[HANDSHAKE] Timed out. Resending..."));
          loadWifiCredentials(); 
          lastWifiConfigSent = millis();
      }
      return; // Stop loop here if not connected
  }

  // 4. Run Main System Modes (Only runs if Connected)
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

    // Get Data from Sensor Class
    // BMP returns Pascals, divide by 100 for hPa
    float pressure = mySensor.bmpPressure() / 100.0; 
    int rainValue = mySensor.rainAnalog(); 
    int soilValue = mySensor.soilAnalog(); 
    long waterDistanceCM = mySensor.ultrasonicDistance(); 

    // Validation: If BMP is 0, something is wrong with I2C
    if (pressure < 1.0) {
        Serial.println(F("AUTO LOG: Sensor Error (Pressure 0). Skipping upload."));
        return;
    }

    // Send Data using Communication Class
    comms.sendSensorReport("AUTO", pressure, rainValue, soilValue, waterDistanceCM);
    
    Serial.println(F("AUTO LOG: Data Sent to ESP.")); 
  }
}

void runMaintenanceMode() {
  char cmd = 0;
  
  // Check Hardware Serial (PC) or Software Serial (ESP) for commands
  if (Serial.available() > 0) {
    cmd = Serial.read();
  } else if (comms.available() > 0) {
    cmd = comms.read();
  }

  // Filter invalid characters
  if (cmd == 0 || cmd == '\n' || cmd == '\r' || cmd == ' ') return; 
  
  // Simple Debounce for Command
  static char lastCmd = 0;
  static unsigned long lastCmdTime = 0;
  if (cmd == lastCmd && millis() - lastCmdTime < 1000) return;
  lastCmd = cmd;
  lastCmdTime = millis();

  Serial.print(F("CMD: ")); Serial.println(cmd);

  switch (cmd) {
    case 'U': case 'u': 
      {
        long val = mySensor.ultrasonicDistance();
        Serial.print(F("WATER: ")); Serial.println(val);
        comms.sendSingleResponse("waterDistanceCM", (float)val);
      } break;
    case 'R': case 'r': 
      {
        int val = mySensor.rainAnalog();
        Serial.print(F("RAIN: ")); Serial.println(val);
        comms.sendSingleResponse("rainRaw", (float)val);
      } break;
    case 'S': case 's': 
      {
        int val = mySensor.soilAnalog();
        Serial.print(F("SOIL: ")); Serial.println(val);
        comms.sendSingleResponse("soilRaw", (float)val);
      } break;
    case 'P': case 'p': 
      {
        float val = mySensor.bmpPressure() / 100.0;
        Serial.print(F("PRESSURE: ")); Serial.println(val);
        comms.sendSingleResponse("pressureHPA", val);
      } break;
    case 'L': case 'l': 
      // Toggle Built-in LED for testing
      digitalWrite(13, !digitalRead(13)); 
      Serial.println(F("LED Toggled"));
      comms.sendSingleResponse("led", "toggled");
      break;
    case 'W': case 'w':
      Serial.println(F("=== WI-FI SETUP ==="));
      Serial.println(F("Type: SSID,PASSWORD (in Serial Monitor)"));
      
      // Clear buffer
      while (Serial.available()) { Serial.read(); delay(2); } 
      
      // Wait for user input (Timeout 30s)
      unsigned long startTime = millis();
      while(Serial.available() == 0 && (millis() - startTime < 30000)) {
        if(digitalRead(BUTTON_PIN) == LOW) return; // Exit if button pressed
        delay(10);
      }
      if (Serial.available() == 0) {
        Serial.println(F("Timeout."));
        return;
      }
      
      // Parse Input
      String input = Serial.readStringUntil('\n');
      input.trim();
      int commaIndex = input.indexOf(',');
      if (commaIndex > 0) {
        String newSSID = input.substring(0, commaIndex);
        String newPass = input.substring(commaIndex + 1);
        
        // Validate Length
        if (newSSID.length() >= 32 || newPass.length() >= 32) {
           Serial.println(F("Error: Name too long (Max 32)."));
        } else {
           saveWifiCredentials(newSSID, newPass);
        }
      } else {
        Serial.println(F("Error: No comma found. format: ssid,pass"));
      }
      break;
  }
}

void runSleepMode() {
  Serial.println(F("System Sleeping..."));
  Serial.flush(); 
  
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  // Wait for button release before sleeping
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  
  sleep_mode(); // CPU Halts Here
  
  // -- Code Resumes Here after Interrupt --
  sleep_disable(); 
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN)); 
  
  currentState = AUTO_MODE; 
  Serial.println(F("Woke up!"));
  modeChangeFlag = true;

  // Debounce wake up
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

// ==========================================
//    HELPER FUNCTIONS
// ==========================================

void updateConnectionStatus() {
  // Use the Communication class to check for status updates
  String status = comms.listenForStatus();

  if (status != "") {
    if (status == "CONN_OK") {
      if (!isWifiConnected) {
        Serial.println(F("[HANDSHAKE] Connected!"));
        isWifiConnected = true;
        configSentInAttempt = true; 
      }
    }
    else if (status == "CONN_FAIL" || status == "NO_SSID" || status == "CONN_LOST") {
      Serial.print(F("[HANDSHAKE] Connection Failed: ")); Serial.println(status);
      isWifiConnected = false; 
      configSentInAttempt = false; // Reset to allow credential resend
      lastWifiConfigSent = 0; 
    }
  }
}

void changeModeISR() {
  static unsigned long last_interrupt_time = 0;
  unsigned long interrupt_time = millis();
  if (interrupt_time - last_interrupt_time > 200) {
    currentState = (SystemState)((currentState + 1) % 3);
    modeChangeFlag = true; 
  }
  last_interrupt_time = interrupt_time;
}

void loadWifiCredentials() {
  if (!wifiStore.hasCredentials()) {
    Serial.println(F("EEPROM: Empty. Configure in Maintenance Mode."));
    return;
  } 

  char ssid[32];
  char pass[32];
  wifiStore.load(ssid, pass);

  // Use Communication class to package and send credentials
  comms.sendWifiConfig(String(ssid), String(pass));
}

void saveWifiCredentials(String newSSID, String newPass) {
  Serial.print(F("Saving to EEPROM..."));
  
  wifiStore.save(newSSID, newPass);
  
  Serial.println(F(" Saved!"));
  
  // Force reconnect logic
  isWifiConnected = false;
  configSentInAttempt = false;
  lastWifiConfigSent = 0; 
}
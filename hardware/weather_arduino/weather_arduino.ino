#include <avr/sleep.h> 

// --- 1. INCLUDE CUSTOM LIBRARIES ---
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

// --- 3. FLAGS ---
bool isWifiConnected = false;        
unsigned long lastWifiConfigSent = 0; 
bool configSentInAttempt = false; 

// --- 4. OBJECTS ---
// ESP32 TX (Pin 17) -> Arduino Pin 4 (RX)
// ESP32 RX (Pin 16) -> Arduino Pin 5 (TX)
Communication comms(4, 5); 

Sensor mySensor(6, 7, A3, A2);
WifiConfig wifiStore;

// --- 5. PINS & TIMERS ---
const int BUTTON_PIN = 2; 
unsigned long previousMillis = 0;
const long INTERVAL = 2000;    
const long RESEND_INTERVAL = 3000; 

// --- PROTOTYPES ---
void executeMaintenanceCommand(char cmd);
void loadWifiCredentials();
void saveWifiCredentials(String s, String p);
void runAutoMode();
void runMaintenanceMode();
void runSleepMode();
void changeModeISR();
void wakeISR();
void updateConnectionStatus(); 

void setup() {
  Serial.begin(9600);     
  comms.begin(9600);
  
  Serial.println(F("Initializing System..."));
  
  mySensor.begin();
  mySensor.BMP180(); 

  // Pins Setup
  for (int i = 8; i <= 13; i++) pinMode(i, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);
  pinMode(A0, INPUT_PULLUP);
  pinMode(A1, INPUT_PULLUP);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  delay(1000); 
}

void loop() {
  delay(10); 
  
  // 1. Connection Check (Priority 1)
  // We check this first to ensure flags like isWifiConnected are up to date.
  if (currentState != MAINTENANCE_MODE) {
     updateConnectionStatus();
  }
  
  // 2. Handle Mode Change (Manual Button Press)
  if (modeChangeFlag) {
    String modeName = (currentState == AUTO_MODE) ? "AUTO" : 
                      (currentState == MAINTENANCE_MODE) ? "MAINTENANCE" : "SLEEP";
    Serial.print(F("Mode Changed to: ")); Serial.println(modeName);
    comms.sendMode(modeName);
    modeChangeFlag = false; 
  }

  // 3. Handshake Retry Logic (Block modes until connected)
  // Note: We skip this block in Maintenance Mode to allow debugging even without WiFi if needed,
  // but generally, you want WiFi for the commands to arrive.
  if (!isWifiConnected && currentState != MAINTENANCE_MODE) {
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
      return; // Stop here if not connected
  }

  // 4. Run State Machine
  switch (currentState) {
    case AUTO_MODE:
      runAutoMode();
      break;
    
    // ⭐ LOGIC UPDATE: This is where we listen for "R", "S", "U", "P"
    case MAINTENANCE_MODE:
      runMaintenanceMode(); 
      break;
      
    case SLEEP_MODE:
      runSleepMode();
      break;
  }
}

// ==========================================
//    MODE FUNCTIONS
// ==========================================

void runAutoMode() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= INTERVAL) {
    previousMillis = currentMillis;

    float pressure = mySensor.bmpPressure() / 100.0; 
    int rainValue = mySensor.rainAnalog(); 
    int soilValue = mySensor.soilAnalog(); 
    long waterDistanceCM = mySensor.ultrasonicDistance(); 

    if (pressure < 1.0) {
        Serial.println(F("AUTO LOG: Sensor Error. Skipping."));
        return;
    }

    comms.sendSensorReport("AUTO", pressure, rainValue, soilValue, waterDistanceCM);
    Serial.println(F("AUTO LOG: Data Sent.")); 
  }
}

// ⭐ UPDATED: Listens for commands and SENDS VALUES BACK
void runMaintenanceMode() {
  char cmd = 0;
  
  // 1. Check Software Serial (Signal from ESP32)
  if (comms.available() > 0) {
    cmd = comms.read();
    Serial.print(F("[MAINTENANCE] Received: "));
    Serial.println(cmd);
  }
  // 2. Check USB Serial (Debug)
  else if (Serial.available() > 0) {
    cmd = Serial.read();
  }

  // If valid command, execute
  if (cmd == 'R' || cmd == 'r' || cmd == 'S' || cmd == 's' || 
      cmd == 'U' || cmd == 'u' || cmd == 'P' || cmd == 'p' || 
      cmd == 'W' || cmd == 'w') {
      
      executeMaintenanceCommand(cmd);
  }
}

void executeMaintenanceCommand(char cmd) {
  Serial.print(F("EXECUTING: ")); Serial.println(cmd);

  switch (cmd) {
    // ----------------------------------------------
    // ⭐ SENSOR TESTS: Read & Send Value to ESP
    // ----------------------------------------------
    case 'U': case 'u': 
      {
        long val = mySensor.ultrasonicDistance();
        Serial.print(F("Reading WATER: ")); Serial.println(val);
        // Sends: {"waterDistanceCM": val}
        comms.sendSingleResponse("waterDistanceCM", (float)val);
      } break;

    case 'R': case 'r': 
      {
        int val = mySensor.rainAnalog();
        Serial.print(F("Reading RAIN: ")); Serial.println(val);
        // Sends: {"rainRaw": val}
        comms.sendSingleResponse("rainRaw", (float)val);
      } break;

    case 'S': case 's': 
      {
        int val = mySensor.soilAnalog();
        Serial.print(F("Reading SOIL: ")); Serial.println(val);
        // Sends: {"soilRaw": val}
        comms.sendSingleResponse("soilRaw", (float)val);
      } break;

    case 'P': case 'p': 
      {
        float val = mySensor.bmpPressure() / 100.0;
        Serial.print(F("Reading PRESSURE: ")); Serial.println(val);
        // Sends: {"pressureHPA": val}
        comms.sendSingleResponse("pressureHPA", val);
      } break;

    case 'W': case 'w':
      Serial.println(F("=== WI-FI SETUP ==="));
      while (Serial.available()) { Serial.read(); delay(2); } 
      
      unsigned long startTime = millis();
      while(Serial.available() == 0 && (millis() - startTime < 30000)) {
        if(digitalRead(BUTTON_PIN) == LOW) return; 
        delay(10);
      }
      if (Serial.available() == 0) return;
      
      String input = Serial.readStringUntil('\n');
      input.trim();
      int commaIndex = input.indexOf(',');
      if (commaIndex > 0) {
        String newSSID = input.substring(0, commaIndex);
        String newPass = input.substring(commaIndex + 1);
        if (newSSID.length() >= 32) {
           Serial.println(F("Error: Name too long."));
        } else {
           saveWifiCredentials(newSSID, newPass);
        }
      }
      break;
  }
}

void runSleepMode() {
  Serial.println(F("Sleeping..."));
  Serial.flush(); 
  
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));

  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  delay(500); 
  
  EIFR = bit(INTF0); 

  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), wakeISR, LOW);

  while (true) {
    sleep_mode(); 
    sleep_disable(); 
    if (digitalRead(BUTTON_PIN) == LOW) break; 
    else sleep_enable();
  }

  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
  Serial.println(F("Woke up!"));

  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  delay(200);

  currentState = AUTO_MODE; 
  modeChangeFlag = true;
  
  EIFR = bit(INTF0); 
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

void wakeISR() { }

// ==========================================
//    HELPER FUNCTIONS
// ==========================================

void updateConnectionStatus() {
  // Read from ESP to see if we are connected
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
      Serial.print(F("[HANDSHAKE] Failed: ")); Serial.println(status);
      isWifiConnected = false; 
      configSentInAttempt = false; 
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
    Serial.println(F("EEPROM: Empty."));
    return;
  } 
  char ssid[32];
  char pass[32];
  wifiStore.load(ssid, pass);
  comms.sendWifiConfig(String(ssid), String(pass));
}

void saveWifiCredentials(String newSSID, String newPass) {
  wifiStore.save(newSSID, newPass);
  Serial.println(F("Saved!"));
  isWifiConnected = false;
  configSentInAttempt = false;
  lastWifiConfigSent = 0; 
}
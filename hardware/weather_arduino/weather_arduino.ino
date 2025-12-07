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
Communication comms(4, 5); 

// Sensor Pin Definitions: 
// Trig=6, Echo=7, Rain=A3, Soil=A2
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

  // --- ⭐ PIN SETUP FIX ---
  // Enable PULLUP on the ACTUAL sensor pins (A2, A3).
  // This ensures they read ~1023 (Dry) when disconnected, not random noise.
  pinMode(A2, INPUT_PULLUP); // Soil Sensor
  pinMode(A3, INPUT_PULLUP); // Rain Sensor
  
  // Set unused pins to pullup to reduce overall noise (optional)
  pinMode(A0, INPUT_PULLUP);
  pinMode(A1, INPUT_PULLUP);
  for (int i = 8; i <= 13; i++) pinMode(i, INPUT_PULLUP);
  pinMode(3, INPUT_PULLUP);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  delay(1000); 
}

void loop() {
  delay(10); 
  
  if (currentState != MAINTENANCE_MODE) {
     updateConnectionStatus();
  }
  
  if (modeChangeFlag) {
    String modeName = (currentState == AUTO_MODE) ? "AUTO" : 
                      (currentState == MAINTENANCE_MODE) ? "MAINTENANCE" : "SLEEP";
    Serial.print(F("Mode Changed to: ")); Serial.println(modeName);
    comms.sendMode(modeName);
    modeChangeFlag = false; 
  }

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
      return; 
  }

  switch (currentState) {
    case AUTO_MODE: runAutoMode(); break;
    case MAINTENANCE_MODE: runMaintenanceMode(); break;
    case SLEEP_MODE: runSleepMode(); break;
  }
}

// ==========================================
//    MODE FUNCTIONS
// ==========================================

void runAutoMode() {
  unsigned long currentMillis = millis();

  if (currentMillis - previousMillis >= INTERVAL) {
    previousMillis = currentMillis;

    // 1. Force pins high before reading (Anti-float measure)
    pinMode(A3, INPUT_PULLUP); 
    pinMode(A2, INPUT_PULLUP);

    float pressure = mySensor.bmpPressure() / 100.0; 
    int rainValue = mySensor.rainAnalog(); 
    int soilValue = mySensor.soilAnalog(); 
    long waterDistanceCM = mySensor.ultrasonicDistance(); 

    // 2. Error Checks
    if (pressure < 10.0) pressure = -1.0; 
    if (waterDistanceCM == 0 || waterDistanceCM > 400) waterDistanceCM = -1;

    comms.sendSensorReport("AUTO", pressure, rainValue, soilValue, waterDistanceCM);
    Serial.println(F("AUTO LOG: Data Sent.")); 
  }
}

void runMaintenanceMode() {
  char cmd = 0;
  
  if (comms.available() > 0) {
    cmd = comms.read();
    Serial.print(F("[MAINTENANCE] Received: ")); Serial.println(cmd);
  } else if (Serial.available() > 0) {
    cmd = Serial.read();
  }

  if (cmd == 'R' || cmd == 'r' || cmd == 'S' || cmd == 's' || 
      cmd == 'U' || cmd == 'u' || cmd == 'P' || cmd == 'p' || 
      cmd == 'W' || cmd == 'w') {
      executeMaintenanceCommand(cmd);
  }
}

void executeMaintenanceCommand(char cmd) {
  Serial.print(F("EXECUTING: ")); Serial.println(cmd);

  switch (cmd) {
    case 'U': case 'u': 
      {
        long val = mySensor.ultrasonicDistance();
        if (val == 0 || val > 400) val = -1;
        Serial.print(F("Reading WATER: ")); Serial.println(val);
        comms.sendSingleResponse("waterDistanceCM", (float)val);
      } break;

    case 'R': case 'r': 
      {
        pinMode(A3, INPUT_PULLUP); // Force stable read
        int val = mySensor.rainAnalog();
        Serial.print(F("Reading RAIN: ")); Serial.println(val);
        comms.sendSingleResponse("rainRaw", (float)val);
      } break;

    case 'S': case 's': 
      {
        pinMode(A2, INPUT_PULLUP); // Force stable read
        int val = mySensor.soilAnalog();
        Serial.print(F("Reading SOIL: ")); Serial.println(val);
        comms.sendSingleResponse("soilRaw", (float)val);
      } break;

    case 'P': case 'p': 
      {
        float val = mySensor.bmpPressure() / 100.0;
        if (val < 10.0) val = -1.0;
        Serial.print(F("Reading PRESSURE: ")); Serial.println(val);
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
        if (newSSID.length() >= 32) Serial.println(F("Error: Name too long."));
        else saveWifiCredentials(newSSID, newPass);
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
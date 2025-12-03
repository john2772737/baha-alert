#include <avr/sleep.h> 

// --- 1. INCLUDE CUSTOM LIBRARIES ---
#include "Sensor.h" 
#include "Communication.h"
#include "WifiConfig.h"
// Removed ServoGauge.h

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

// Communication (RX=4, TX=5)
Communication comms(4, 5);

// Sensor (Trig=6, Echo=7, Soil=A3, Rain=A2)
Sensor mySensor(6, 7, A3, A2);

// WiFi Storage
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
void wakeISR(); // New prototype for sleep wake up
void updateConnectionStatus(); 

void setup() {
  Serial.begin(9600);     
  comms.begin(9600);
  
  Serial.println(F("Initializing System..."));
  
  mySensor.begin();
  mySensor.BMP180(); 

  // --- DISABLE UNUSED PINS ---
  pinMode(3, INPUT_PULLUP);
  pinMode(8, INPUT_PULLUP);
  pinMode(9, INPUT_PULLUP);
  pinMode(10, INPUT_PULLUP);
  pinMode(11, INPUT_PULLUP);
  pinMode(12, INPUT_PULLUP);
  pinMode(13, INPUT_PULLUP);
  pinMode(A0, INPUT_PULLUP);
  pinMode(A1, INPUT_PULLUP);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  delay(1000); 
}

void loop() {
  delay(10); 
  
  updateConnectionStatus();
  
  if (modeChangeFlag) {
    String modeName = (currentState == AUTO_MODE) ? "AUTO" : 
                      (currentState == MAINTENANCE_MODE) ? "MAINTENANCE" : "SLEEP";
    comms.sendMode(modeName);
    modeChangeFlag = false; 
  }

  // Handshake Logic
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
      return; 
  }

  // Run Modes
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

    // 1. Get Sensor Data
    float pressure = mySensor.bmpPressure() / 100.0; 
    int rainValue = mySensor.rainAnalog(); 
    int soilValue = mySensor.soilAnalog(); 
    long waterDistanceCM = mySensor.ultrasonicDistance(); 

    if (pressure < 1.0) {
        Serial.println(F("AUTO LOG: Sensor Error. Skipping."));
        return;
    }

    // 2. Send Data to ESP
    comms.sendSensorReport("AUTO", pressure, rainValue, soilValue, waterDistanceCM);
    Serial.println(F("AUTO LOG: Data Sent.")); 
  }
}

void runMaintenanceMode() {
  char cmd = 0;
  
  if (Serial.available() > 0) cmd = Serial.read();
  else if (comms.available() > 0) cmd = comms.read();

  if (cmd == 0 || cmd == '\n' || cmd == '\r' || cmd == ' ') return; 
  
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
  
  // 1. Detach Interrupts to prevent mode jumping
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));

  // 2. Wait for Button Release (Essential)
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  delay(500); // Increased Debounce to 500ms
  
  // 3. Clear existing interrupt flags
  EIFR = bit(INTF0); 

  // 4. Configure Sleep
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  // 5. Attach Wake Interrupt (LOW level)
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), wakeISR, LOW);

  // 6. SLEEP LOOP (Prevention for False Wakeups)
  while (true) {
    sleep_mode(); // Go to sleep
    
    // --- WAKE UP POINT ---
    
    sleep_disable(); // Temporarily disable sleep logic

    // Check: Did we wake up because the button is REALLY pressed?
    if (digitalRead(BUTTON_PIN) == LOW) {
      // Yes, button is held down. This is a real wake up.
      break; 
    } else {
      // No, button is HIGH. This was noise or a glitch.
      // Re-enable sleep and go back to bed.
      sleep_enable();
    }
  }

  // 7. Full Wake Up Logic
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));
  Serial.println(F("Woke up!"));

  // 8. Wait for Wake Button Release
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  delay(200);

  // 9. Restore Normal Operation
  currentState = AUTO_MODE; 
  modeChangeFlag = true;
  
  EIFR = bit(INTF0); // Clear flags again
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

// Dummy ISR just to wake the CPU
void wakeISR() {
  // Do nothing
}

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
#include <SoftwareSerial.h>
#include <avr/sleep.h> 
#include <ArduinoJson.h> 
#include <EEPROM.h>

// --- 1. SENSOR LIBRARY (Single Class) ---
#include "Sensor.h" 

// --- EEPROM CODE ---
struct WifiCredentials {
  char ssid[32];     
  char password[32]; 
};
WifiCredentials creds;

// --- 2. SYSTEM MODES ---
enum SystemState {
  AUTO_MODE,
  MAINTENANCE_MODE,
  SLEEP_MODE
};

volatile SystemState currentState = AUTO_MODE;
volatile bool modeChangeFlag = false; 

// HANDSHAKE FLAGS
bool isWifiConnected = false;        
unsigned long lastWifiConfigSent = 0; 
bool configSentInAttempt = false; 

// --- 3. PINS & OBJECTS ---
const int BUTTON_PIN = 2;       
const int ESP_RX = 4;           
const int ESP_TX = 5;           
SoftwareSerial espSerial(ESP_RX, ESP_TX); 

// Initialize the Single Sensor Object
// Order from Sensor.h: (trigPin, echoPin, soilPin, rainPin)
// Based on your previous code: Trig=6, Echo=7, Soil=A3, Rain=A2
Sensor mySensor(6, 7, A3, A2);

// --- 4. TIMERS ---
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
void sendModeStatus(); 
void checkESPStatus(); 

void setup() {
  Serial.begin(9600);     
  espSerial.begin(9600);  
  
  Serial.println(F("Initializing Unified Sensor Class..."));
  
  // Initialize the sensor pins
  mySensor.begin();
  // Initialize the BMP sensor specifically
  mySensor.BMP180();

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("System Started: AUTO MODE"));
  
  Serial.flush(); 
  delay(1000); 
}

void loop() {
  delay(10); 
  
  checkESPStatus();
  
  if (modeChangeFlag) {
    sendModeStatus();
    modeChangeFlag = false; 
  }

  // --- CONNECTION HANDSHAKE LOOP ---
  if (!isWifiConnected) {
      if (!configSentInAttempt) {
          Serial.println(F("[HANDSHAKE] Waiting for connection... Sending Credentials..."));
          loadWifiCredentials(); 
          lastWifiConfigSent = millis();
          configSentInAttempt = true; 
      } else if (millis() - lastWifiConfigSent > RESEND_INTERVAL) { 
          Serial.println(F("[HANDSHAKE] Connection failed/timed out. Resending Credentials..."));
          loadWifiCredentials(); 
          lastWifiConfigSent = millis();
      }
      return; 
  }

  // --- Normal Operation ---
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

    // USE SENSOR CLASS METHODS
    // Note: bmpPressure returns Pa, we divide by 100 for hPa
    float pressure = mySensor.bmpPressure() / 100.0;
    int rainValue = mySensor.rainAnalog(); 
    int soilValue = mySensor.soilAnalog(); 
    long waterDistanceCM = mySensor.ultrasonicDistance(); 

    // Error check for BMP
    if (pressure < 1.0) {
        Serial.println(F("AUTO LOG: Pressure read failed. Skipping upload."));
        return;
    }

    StaticJsonDocument<256> doc;
    doc["mode"] = "AUTO";
    doc["pressure"] = pressure;
    doc["rain"] = rainValue;
    doc["soil"] = soilValue;
    doc["waterDistanceCM"] = waterDistanceCM;

    char dataBuffer[256];
    serializeJson(doc, dataBuffer);

    espSerial.println(dataBuffer); 
    espSerial.flush();
    
    Serial.print(F("AUTO LOG: ")); 
    Serial.println(dataBuffer); 
  }
}

void runMaintenanceMode() {
  char cmd = 0;
  
  if (Serial.available() > 0) {
    cmd = Serial.read();
  } else if (espSerial.available() > 0) {
    cmd = espSerial.read();
  }

  if (cmd == 0 || cmd == '\n' || cmd == '\r' || cmd == ' ') return; 
  
  if (cmd != 0) {
    static char lastCmd = 0;
    static unsigned long lastCmdTime = 0;
    if (cmd == lastCmd && millis() - lastCmdTime < 1000) return;
    
    lastCmd = cmd;
    lastCmdTime = millis();

    Serial.print(F("CMD RECEIVED: ")); Serial.println(cmd);

    switch (cmd) {
      case 'U': case 'u': 
        {
          long val = mySensor.ultrasonicDistance();
          Serial.print(F("WATER (CM): ")); Serial.println(val);
          espSerial.println("{\"sensor\":\"waterDistanceCM\",\"val\":" + String(val) + "}");
        } break;
      case 'R': case 'r': 
        {
          int val = mySensor.rainAnalog();
          Serial.print(F("RAIN (RAW): ")); Serial.println(val);
          espSerial.println("{\"sensor\":\"rainRaw\",\"val\":" + String(val) + "}");
        } break;
      case 'S': case 's': 
        {
          int val = mySensor.soilAnalog();
          Serial.print(F("SOIL (RAW): ")); Serial.println(val);
          espSerial.println("{\"sensor\":\"soilRaw\",\"val\":" + String(val) + "}");
        } break;
      case 'P': case 'p': 
        {
          float val = mySensor.bmpPressure() / 100.0;
          Serial.print(F("PRESSURE (hPA): ")); Serial.println(val);
          espSerial.println("{\"sensor\":\"pressureHPA\",\"val\":" + String(val, 2) + "}");
        } break;
      case 'L': case 'l': 
        digitalWrite(13, !digitalRead(13)); 
        Serial.println(F("LED Toggled"));
        espSerial.println("{\"sensor\":\"led\",\"val\":\"toggled\"}");
        break;
      case 'W': case 'w':
        Serial.println(F("=== WI-FI SETUP ==="));
        Serial.println(F("**SSID,PASSWORD**"));
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
          if (newSSID.length() >= 32 || newPass.length() >= 32) {
             Serial.println(F("Error: Too long."));
          } else {
             Serial.print(F("Saving: ")); Serial.println(newSSID);
             saveWifiCredentials(newSSID, newPass);
          }
        }
        break;
      default: Serial.println(F("Unknown Command")); break;
    }
  }
}

void runSleepMode() {
  Serial.println(F("System Sleeping..."));
  Serial.flush(); 
  
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  sleep_mode(); 
  sleep_disable(); 
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN)); 
  
  currentState = AUTO_MODE; 
  Serial.println(F("Woke up!"));
  modeChangeFlag = true;

  while (digitalRead(BUTTON_PIN) == LOW) { delay(50); }
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

// ==========================================
//    INTERRUPT and STATUS FUNCTIONS
// ==========================================

char incomingBuffer[100]; 
byte bufferIndex = 0;

void checkESPStatus() {
    while (espSerial.available()) {
        char inChar = espSerial.read();
        if (inChar == '{') {
            bufferIndex = 0;
            incomingBuffer[bufferIndex++] = inChar;
        } 
        else if (bufferIndex > 0 && bufferIndex < 99) {
            incomingBuffer[bufferIndex++] = inChar;
            if (inChar == '}') {
                incomingBuffer[bufferIndex] = '\0'; 
                
                StaticJsonDocument<256> doc; 
                DeserializationError error = deserializeJson(doc, incomingBuffer);
                bufferIndex = 0; 
                
                if (error || !doc.containsKey("status")) return;

                String status = doc["status"].as<String>();
                
                if (status == "CONN_OK") {
                    if (!isWifiConnected) {
                        Serial.println(F("[HANDSHAKE] ESP Connected! Starting Sensor Loop."));
                        isWifiConnected = true;
                        configSentInAttempt = true; 
                    }
                }
                else if (status == "CONN_FAIL" || status == "NO_SSID" || status == "CONN_LOST") {
                    Serial.print(F("[HANDSHAKE] Connection Failed: "));
                    Serial.println(status);
                    isWifiConnected = false; 
                    configSentInAttempt = false; 
                    lastWifiConfigSent = 0; 
                }
            }
        }
    }
}

void sendModeStatus() {
  String modeString;
  switch (currentState) {
    case AUTO_MODE: modeString = "AUTO"; break;
    case MAINTENANCE_MODE: modeString = "MAINTENANCE"; break;
    case SLEEP_MODE: modeString = "SLEEP"; break;
  }
  String data = "{\"mode\":\"" + modeString + "\"}";
  espSerial.println(data);
  espSerial.flush();
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
  EEPROM.get(0, creds); 
  
  if (creds.ssid[0] == 0 || creds.ssid[0] == 0xFF) {
    Serial.println(F("EEPROM: Empty. Please set credentials in Maintenance Mode."));
    return;
  } 

  String config = "{\"type\":\"config\",\"ssid\":\"" + String(creds.ssid) + "\",\"pass\":\"" + String(creds.password) + "\"}";
  espSerial.println(config);
  espSerial.flush();
}

void saveWifiCredentials(String newSSID, String newPass) {
  memset(creds.ssid, 0, 32);
  memset(creds.password, 0, 32);
  newSSID.toCharArray(creds.ssid, 32);
  newPass.toCharArray(creds.password, 32);
  EEPROM.put(0, creds);
  Serial.println(F(" -> Saved!"));
  isWifiConnected = false;
}
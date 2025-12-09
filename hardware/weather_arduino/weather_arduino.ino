#include <avr/sleep.h> 
#include "Sensor.h" 
#include "Communication.h"
#include "WifiConfig.h"

// --- RENAMED STATES to avoid conflicts ---
enum SystemState {
  STATE_AUTO,
  STATE_MAINTENANCE,
  STATE_SLEEP
};

volatile SystemState currentState = STATE_AUTO;
volatile bool modeChangeFlag = false; 

bool isWifiConnected = false;        
unsigned long lastWifiConfigSent = 0; 
bool configSentInAttempt = false; 

// Trig=6, Echo=7, Rain=A3, Soil=A2
Sensor mySensor(6, 7, A3, A2); 
Communication comms(4, 5); 
WifiConfig wifiStore;

const int BUTTON_PIN = 2; 
unsigned long previousMillis = 0;
const long INTERVAL = 2000;    
const long RESEND_INTERVAL = 3000; 

// Prototypes
void runAutoMode();
void runMaintenanceMode();
void runSleepMode();
void changeModeISR();
void wakeISR();
void loadWifiCredentials();
void saveWifiCredentials(String s, String p);

void setup() {
  Serial.begin(9600);     
  comms.begin(9600);
  
  Serial.println(F("Init...")); // F() saves memory
  
  mySensor.begin();
  mySensor.BMP180(); 

  pinMode(A2, INPUT_PULLUP);
  pinMode(A3, INPUT_PULLUP);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
  
  Serial.println(F("Started: AUTO"));
}

void loop() {
  if (currentState != STATE_MAINTENANCE) {
     String status = comms.listenForStatus();
     if (status.length() > 0) {
        if (status == "CONN_OK") {
            if (!isWifiConnected) { 
                Serial.println(F("Wifi OK")); 
                isWifiConnected = true; 
                configSentInAttempt = true; 
            }
        } else if (status.startsWith("CONN_FAIL")) {
            isWifiConnected = false; 
            configSentInAttempt = false;
        }
     }
  }
  
  if (modeChangeFlag) {
    if (currentState == STATE_AUTO) comms.sendMode("AUTO");
    else if (currentState == STATE_MAINTENANCE) comms.sendMode("MAINTENANCE");
    else comms.sendMode("SLEEP");
    modeChangeFlag = false; 
  }

  if (!isWifiConnected && currentState != STATE_MAINTENANCE) {
      if (!configSentInAttempt || (millis() - lastWifiConfigSent > RESEND_INTERVAL)) {
          loadWifiCredentials(); 
          lastWifiConfigSent = millis();
          configSentInAttempt = true; 
      }
      return; 
  }

  switch (currentState) {
    case STATE_AUTO: runAutoMode(); break;
    case STATE_MAINTENANCE: runMaintenanceMode(); break;
    case STATE_SLEEP: runSleepMode(); break;
  }
}

void runAutoMode() {
  if (millis() - previousMillis >= INTERVAL) {
    previousMillis = millis();
    pinMode(A3, INPUT_PULLUP); 
    pinMode(A2, INPUT_PULLUP);

    float p = mySensor.bmpPressure(); 
    int r = mySensor.rainAnalog(); 
    int s = mySensor.soilAnalog(); 
    long w = mySensor.ultrasonicDistance(); 

    if (p < 10.0) p = -1.0; 
    if (w == 0 || w > 400) w = -1;

    comms.sendSensorReport("AUTO", p, r, s, w);
    Serial.println(F("Data Sent")); 
  }
}

void runMaintenanceMode() {
  char cmd = 0;
  if (comms.available() > 0) cmd = comms.read();
  else if (Serial.available() > 0) cmd = Serial.read();

  if (cmd == 0) return;

  switch (cmd) {
    case 'U': case 'u': 
      comms.sendSingleResponse("waterDistanceCM", (float)mySensor.ultrasonicDistance()); break;
    case 'R': case 'r': 
      pinMode(A3, INPUT_PULLUP);
      comms.sendSingleResponse("rainRaw", (float)mySensor.rainAnalog()); break;
    case 'S': case 's': 
      pinMode(A2, INPUT_PULLUP);
      comms.sendSingleResponse("soilRaw", (float)mySensor.soilAnalog()); break;
    case 'P': case 'p': 
      comms.sendSingleResponse("pressureHPA", mySensor.bmpPressure()); break;
    
    case 'W': case 'w':
      // --- MEMORY OPTIMIZED WI-FI SETUP ---
      // Replaces heavy readStringUntil with lightweight char buffer
      Serial.println(F("Wifi Setup:"));
      while (Serial.available()) Serial.read(); // Clear
      
      unsigned long start = millis();
      while(Serial.available() == 0 && (millis() - start < 30000)) {
         if(digitalRead(BUTTON_PIN) == LOW) return;
      }
      if (!Serial.available()) return;

      char buf[60];
      int len = Serial.readBytesUntil('\n', buf, 59);
      buf[len] = 0; // Null terminate

      // Basic Parse: "SSID,PASS"
      String raw = String(buf); // Convert once
      int comma = raw.indexOf(',');
      if (comma > 0) {
        saveWifiCredentials(raw.substring(0, comma), raw.substring(comma+1));
      }
      break;
  }
}

void runSleepMode() {
  Serial.println(F("Sleep"));
  delay(100);
  
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), wakeISR, LOW);
  sleep_mode(); 
  sleep_disable(); 
  detachInterrupt(digitalPinToInterrupt(BUTTON_PIN));

  Serial.println(F("Wake"));
  currentState = STATE_AUTO; 
  modeChangeFlag = true;
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), changeModeISR, FALLING);
}

void wakeISR() { }

void changeModeISR() {
  static unsigned long last_time = 0;
  if (millis() - last_time > 200) {
    currentState = (SystemState)((currentState + 1) % 3);
    modeChangeFlag = true; 
  }
  last_time = millis();
}

void loadWifiCredentials() {
  if (wifiStore.hasCredentials()) {
    char ssid[32], pass[32];
    wifiStore.load(ssid, pass);
    comms.sendWifiConfig(String(ssid), String(pass));
  }
}

void saveWifiCredentials(String s, String p) {
  wifiStore.save(s, p);
  Serial.println(F("Saved"));
  isWifiConnected = false;
  configSentInAttempt = false;
}
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>

// --- ESP-01 PIN DEFINITIONS ---
// RX pin: GPIO3 (D3) -> Connects to Arduino Pro Mini TX (D5)
// TX pin: GPIO1 (D1) -> Connects to Arduino Pro Mini RX (D4)
SoftwareSerial Serial2(3, 1);  
// SoftwareSerial(RX_PIN, TX_PIN)

// -------------- SERVER URL ------------------
const char* serverName = "http://baha-alert.vercel.app/api"; 
// Using HTTP (not secure) as standard ESP8266 configuration requires this.

// -------------- WIFI CREDENTIALS --------------
String ssid = "";
String password = "";

// -------------- UPLOAD TIMING ----------------
unsigned long lastUploadTime = 0;
const long uploadInterval = 1500;  // 1.5s minimum interval

// -------------------------------------------------
// SETUP
// -------------------------------------------------
void setup() {
  // Hardware Serial (GPIO1/GPIO3) for debugging on the PC
  Serial.begin(9600); 
  
  // SoftwareSerial is enabled to receive data from the Arduino Pro Mini
  Serial2.begin(9600);

  Serial.println("\n\nESP-01 OPERATIONAL MODE STARTED...");
  Serial.println("!!! WAITING FOR WIFI CONFIGURATION FROM ARDUINO !!!");
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 
}

// -------------------------------------------------
// UPLOAD TO DATABASE (ESP8266 VERSION)
// -------------------------------------------------
void uploadToDatabase(String jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[UPLOAD] ERROR: WiFi NOT connected. Skipping POST.");
    Serial.flush();
    return;
  }
  
  Serial.println("[UPLOAD_FNC] *** Upload function called. Checking DNS... ***"); 
  Serial.flush(); 

  WiFiClient client;
  HTTPClient http;

  http.setTimeout(10000); // 10 seconds timeout

  // --- DNS CHECK (Using Hostname for resolution check) ---
  IPAddress serverIP;
  if (WiFi.hostByName("baha-alert.vercel.app", serverIP)) {
    Serial.print("[DNS] Server IP resolved: ");
    Serial.println(serverIP);
  } else {
    Serial.println("[DNS] ERROR: Hostname resolution failed.");
    Serial.flush();
    return;
  }
  // ---------------------
  
  if (http.begin(client, serverName)) {
    Serial.println("[UPLOAD_FNC] HTTP connection started. Posting payload...");
    Serial.print("[UPLOAD] Payload: ");
    Serial.println(jsonPayload);
    Serial.flush();

    http.addHeader("Content-Type", "application/json");

    int code = http.POST(jsonPayload);

    if (code > 0) {
      Serial.print("[UPLOAD] Success Code: ");
      Serial.println(code);
      if (code != 200) {
        Serial.print("[UPLOAD] Server Response Body: ");
        Serial.println(http.getString());
      }
    } else {
      Serial.print("[UPLOAD] POST ERROR Code: ");
      Serial.println(code);
      Serial.print("[UPLOAD] ERROR String: ");
      Serial.println(http.errorToString(code));
    }

    http.end();
    Serial.flush(); 
  } else {
    Serial.println("[UPLOAD] ERROR: Cannot initiate HTTP connection (DNS/server name issue).");
    Serial.flush();
  }
}

// -------------------------------------------------
// MAIN LOOP
// -------------------------------------------------
void loop() {

  // Check for incoming data from the Arduino Pro Mini on SoftwareSerial
  if (Serial2.available()) {
    // Small delay to ensure the entire line is received
    delay(5); 

    String incomingData = Serial2.readStringUntil('\n');
    incomingData.trim();

    if (incomingData.length() == 0) return;

    // Robustness: Filter out leading junk characters
    int braceIndex = incomingData.indexOf('{');
    if (braceIndex > 0) incomingData = incomingData.substring(braceIndex);
    if (braceIndex == -1) {
      // Serial.println("[FILTER] Invalid data: " + incomingData); // Re-enabling this line if needed
      return; 
    }

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, incomingData);

    if (error) {
      Serial.print("JSON Deserialization Error: ");
      Serial.println(error.c_str());
      return;
    }

    // -----------------------------------------
    // 1. WIFI CONFIG UPDATE (Must come first)
    // -----------------------------------------
    if (doc.containsKey("type") && doc["type"] == "config") {
      ssid = doc["ssid"].as<String>();
      password = doc["pass"].as<String>();

      Serial.println("--- WIFI CREDENTIALS RECEIVED. CONNECTING... ---");
      Serial.println("SSID: " + ssid);

      // Start connection immediately
      WiFi.begin(ssid.c_str(), password.c_str());
      return;
    }

    // -----------------------------------------
    // 2. MODE HANDLING (AUTO, MAINTENANCE, SLEEP)
    // -----------------------------------------
    if (!doc.containsKey("mode")) return;

    String mode = doc["mode"].as<String>();

    // Check if it's a full sensor payload (as opposed to just a mode status notification)
    bool isFullSensorData = doc.containsKey("pressure") && doc.containsKey("rain");
    
    // NEW DIAGNOSTIC PRINT: Confirms the JSON was successfully parsed and passed the mode check
    Serial.println("\n[DATA_RECEIVED] Starting upload sequence (JSON OK)..."); 
    Serial.flush(); 

    // --- Upload Logic (All Modes) ---
    // If the interval has passed, attempt the upload regardless of mode.
    if (millis() - lastUploadTime >= uploadInterval) {
        
        if (mode == "AUTO") {
            if (isFullSensorData) {
                Serial.println("[AUTO] Uploading AUTO sensor data...");
            } else {
                Serial.println("[AUTO] Uploading AUTO status report (Mode Change)...");
            }
        } else if (mode == "MAINTENANCE") {
            Serial.println("[MAINTENANCE] Uploading status report...");
        } else if (mode == "SLEEP") {
            Serial.println("[SLEEP] Uploading status report...");
        }
        
        uploadToDatabase(incomingData);
        lastUploadTime = millis();
    }
  }

  // ---------------- WIFI RECONNECT & STATUS CHECK ----------------
  static unsigned long lastCheck = 0;
  static bool printIP = true; 

  if (millis() - lastCheck > 5000) {
    lastCheck = millis();

    // Check 1: Reconnect if needed
    if (ssid != "" && WiFi.status() != WL_CONNECTED) {
      Serial.println("[WIFI] Reconnecting...");
      WiFi.begin(ssid.c_str(), password.c_str());
      printIP = true; // Reset flag to print IP when connection succeeds
    } 
    
    // Check 2: Print current connection status for debugging
    if (WiFi.status() == WL_CONNECTED) {
        if(printIP) {
            Serial.print("[WIFI] Status: CONNECTED. IP: ");
            Serial.println(WiFi.localIP());
            printIP = false; // Only print once per connection
        }
    } else {
        Serial.print("[WIFI] Status: ");
        Serial.println(WiFi.status());
    }
  }
}
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>

// --- ESP-01 PIN DEFINITIONS ---
// WARNING: GPIO1 (TXD) and GPIO3 (RXD) are used for flashing and Serial Monitor.
// Using them for SoftwareSerial can interfere with debugging and upload processes.
// RX pin: GPIO3 (D3) -> Connects to Arduino Pro Mini TX (D5)
// TX pin: GPIO1 (D1) -> Connects to Arduino Pro Mini RX (D4)
// **TEMPORARILY DISABLE SoftwareSerial to test hardware UART stability:**
// SoftwareSerial Serial2(3, 1);  
// SoftwareSerial(RX_PIN, TX_PIN)

// -------------- SERVER URL ------------------
const char* serverName = "http://baha-alert.vercel.app/api"; 
// Using HTTP (not secure) as standard ESP8266 configuration requires this.

// -------------- WIFI CREDENTIALS (HARDCODE FOR TESTING) --------------
// Replace with your actual Wi-Fi credentials for this test
String ssid = "GlobeAtHome_B37B3";
String password = "18L0DE824YQ";

// -------------- UPLOAD TIMING ----------------
unsigned long lastUploadTime = 0;
// Set a long interval for this test to control the upload timing
const long uploadInterval = 10000; // Upload every 10 seconds for testing

// --- DUMMY PAYLOAD FOR UPLOAD TEST ---
const String DUMMY_PAYLOAD = "{\"mode\":\"TESTING\",\"pressure\":999.0,\"rain\":1,\"soil\":1,\"waterDistanceCM\":0.0}";

// -------------------------------------------------
// SETUP
// -------------------------------------------------
void setup() {
  // Use Hardware Serial (GPIO1/GPIO3) for debugging only
  Serial.begin(9600); 
  
  // Serial2.begin(9600); // DISABLED FOR THIS TEST

  Serial.println("\n\nESP-01 DIAGNOSTIC TEST STARTED...");
  Serial.println("!!! UPLOADING DUMMY PAYLOAD DIRECTLY !!!");
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); 
  
  // Wait for Wi-Fi to connect before starting the loop
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid.c_str(), password.c_str());
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("Connected! IP address: ");
  Serial.println(WiFi.localIP());
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

  // IMPORTANT: Set timeout to ensure the connection doesn't hang indefinitely
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

  // Since SoftwareSerial is disabled, we rely on the timer to trigger the upload
  if (millis() - lastUploadTime >= uploadInterval) {
    
    Serial.println("\n[TIMER] Uploading dummy data..."); 
    Serial.flush(); 

    uploadToDatabase(DUMMY_PAYLOAD);
    lastUploadTime = millis();
  }
  
  // No Wi-Fi reconnect logic needed here as connection is guaranteed in setup.
}
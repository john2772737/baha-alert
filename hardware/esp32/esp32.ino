#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h> 

// ------------------------------------------------
// CONFIGURATION
// ------------------------------------------------
const char* serverName = "https://baha-alert.vercel.app/api"; 

// Pins for communication with Arduino
#define RXD2 16
#define TXD2 17

HTTPClient http;

void setup() {
  // 1. Debug Serial (USB to Computer)
  Serial.begin(115200);
  Serial.println("\n--- ESP32 STARTED ---");

  // 2. Communication Serial (To Arduino)
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
}

void loop() {
  // Check if data is coming from Arduino
  if (Serial2.available()) {
    
    String input = Serial2.readStringUntil('\n');
    input.trim();

    Serial.print("Received from Arduino: ");
    Serial.println(input);

    if (input.length() > 0) {
      handleArduinoMessage(input);
    }
  }
}

void handleArduinoMessage(String input) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.print("JSON Error: ");
    Serial.println(error.c_str());
    return;
  }

  // --- SCENARIO 1: CONFIGURATION ---
  if (doc.containsKey("type") && doc["type"] == "config") {
    Serial.println("Type: Config found. Attempting WiFi...");
    const char* ssid = doc["ssid"];
    const char* pass = doc["pass"];
    connectToWiFi(ssid, pass);
  }

  // --- SCENARIO 2: DATA OR MODE CHANGE ---
  // ⭐ UPDATED: Now checks for 'pressure' (Sensor Data) OR 'mode' (Status Change)
  else if (doc.containsKey("pressure") || doc.containsKey("mode")) {
    Serial.println("Type: Sensor Data or Mode Change found.");
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Sending to API...");
      sendDataToAPI(doc);
    } else {
      Serial.println("WiFi not connected! Requesting Re-handshake.");
      Serial2.println("{\"status\":\"CONN_LOST\"}"); 
    }
  }
}

void connectToWiFi(const char* ssid, const char* pass) {
  Serial.print("Connecting to: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, pass);
  
  unsigned long startAttempt = millis();
  bool connected = false;

  while (millis() - startAttempt < 10000) {
    if (WiFi.status() == WL_CONNECTED) {
      connected = true;
      break;
    }
    Serial.print(".");
    delay(500);
  }
  Serial.println();

  if (connected) {
    Serial.println("WiFi Connected! IP: " + WiFi.localIP().toString());
    delay(200); 
    Serial.println("Sending CONN_OK to Arduino...");
    Serial2.println("{\"status\":\"CONN_OK\"}");
  } else {
    Serial.println("WiFi Timeout. Sending CONN_FAIL to Arduino...");
    Serial2.println("{\"status\":\"CONN_FAIL\"}");
  }
}

void sendDataToAPI(JsonDocument& doc) {
  WiFiClientSecure client;
  client.setInsecure(); // Required for HTTPS (Vercel)

  if (http.begin(client, serverName)) {
    http.addHeader("Content-Type", "application/json");

    String jsonString;
    serializeJson(doc, jsonString);

    int httpResponseCode = http.POST(jsonString);

    Serial.print("API Response: ");
    Serial.println(httpResponseCode); 
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println(response);
    }
  } else {
    Serial.println("Error: Unable to connect to Server");
  }

  http.end();
}
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiClientSecure.h> 

// CONFIGURATION
const char* serverName = "https://baha-alert.vercel.app/api"; 

// Serial2 Pins (ESP32 <-> Arduino)
#define RXD2 16
#define TXD2 17

HTTPClient http;
unsigned long lastPollTime = 0;
const long pollInterval = 2000; // Poll every 2 seconds

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2);
  
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  Serial.println("\n--- ESP32 STARTED ---");
}

void loop() {
  // 1. LISTEN TO ARDUINO
  if (Serial2.available()) {
    String input = Serial2.readStringUntil('\n');
    input.trim();
    if (input.length() > 0) handleArduinoMessage(input);
  }

  // 2. POLL API FOR COMMANDS
  if (WiFi.status() == WL_CONNECTED) {
    if (millis() - lastPollTime > pollInterval) {
      checkForCommands();
      lastPollTime = millis();
    }
  }
}

// Function to poll the Vercel API
void checkForCommands() {
  WiFiClientSecure client;
  client.setInsecure(); // Essential for Vercel HTTPS

  String url = String(serverName) + "?maintenance=true";

  if (http.begin(client, url)) {
    int httpCode = http.GET();

    if (httpCode > 0) {
      String payload = http.getString();
      
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        bool hasCommand = doc["hasCommand"];
        
        if (hasCommand) {
          const char* cmd = doc["command"]; // e.g., "R"
          Serial.print("Executing Command: ");
          Serial.println(cmd);
          Serial2.print(cmd); // Forward to Arduino
        }
      }
    }
    http.end();
  }
}

// Function to handle messages from Arduino
void handleArduinoMessage(String input) {
  StaticJsonDocument<1024> doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.print("JSON Error: "); Serial.println(error.c_str());
    return;
  }

  // Config WiFi
  if (doc.containsKey("type") && doc["type"] == "config") {
    const char* ssid = doc["ssid"];
    const char* pass = doc["pass"];
    connectToWiFi(ssid, pass);
  }
  // Upload Data
  else if (doc.containsKey("pressure") || doc.containsKey("mode")) {
    if (WiFi.status() == WL_CONNECTED) {
      sendDataToAPI(doc);
    } else {
      Serial2.println("{\"status\":\"CONN_LOST\"}"); 
    }
  }
}

void connectToWiFi(const char* ssid, const char* pass) {
  Serial.print("Connecting to: "); Serial.println(ssid);
  WiFi.begin(ssid, pass);
  
  unsigned long startAttempt = millis();
  while (millis() - startAttempt < 10000 && WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected!");
    Serial2.println("{\"status\":\"CONN_OK\"}");
  } else {
    Serial.println("\nFailed.");
    Serial2.println("{\"status\":\"CONN_FAIL\"}");
  }
}

void sendDataToAPI(JsonDocument& doc) {
  WiFiClientSecure client;
  client.setInsecure();

  if (http.begin(client, serverName)) {
    http.addHeader("Content-Type", "application/json");
    String jsonString;
    serializeJson(doc, jsonString);
    http.POST(jsonString);
    http.end();
  }
}
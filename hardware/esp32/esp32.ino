#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- CONFIGURATION ---
// Pins for Serial2 on ESP32
#define RXD2 16
#define TXD2 17

// Your Vercel API URL (use HTTPS)
const char* serverName = "https://my-baha-alert.vercel.app/api/data";

// Global Variables for Wi-Fi
String ssid = "";
String password = "";

void setup() {
    Serial.begin(115200);

    // Serial communication with Arduino
    Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2); 

    Serial.println("\n\nESP32 Receiver Started...");
    Serial.println("Waiting for Arduino on GPIO 16...");

    // Setup Wi-Fi mode
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(); 
}

void loop() {
    // Check if Arduino sent anything
    if (Serial2.available()) {
        String incomingData = Serial2.readStringUntil('\n');
        incomingData.trim();

        if (incomingData.length() > 0) {
            Serial.print("Raw: ");
            Serial.println(incomingData);

            StaticJsonDocument<512> doc;
            DeserializationError error = deserializeJson(doc, incomingData);

            if (!error) {
                // --- CASE 1: Wi-Fi config ---
                if (doc.containsKey("type") && doc["type"] == "config") {
                    ssid = doc["ssid"].as<String>();
                    password = doc["pass"].as<String>();

                    Serial.println("--- NEW WIFI CREDENTIALS ---");
                    Serial.print("SSID: "); Serial.println(ssid);
                    Serial.print("PASS: "); Serial.println(password);

                    WiFi.begin(ssid.c_str(), password.c_str());
                }

                // --- CASE 2: Sensor data ---
                else if (doc.containsKey("mode") && doc["mode"] == "AUTO") {
                    Serial.println("--- DECODED SENSOR DATA ---");
                    Serial.printf("Pressure: %.2f hPa\n", doc["pressure"].as<float>());
                    Serial.println("Rain: " + doc["rain"].as<String>());
                    Serial.println("Water: " + doc["waterLevel"].as<String>());
                    Serial.println("Soil: " + doc["soil"].as<String>());
                    Serial.println("---------------------------");

                    uploadToDatabase(incomingData);
                }

                // --- CASE 3: Maintenance / Test ---
                else if (doc.containsKey("sensor")) {
                    Serial.print("TEST RESULT: "); 
                    Serial.print(doc["sensor"].as<String>());
                    Serial.print(" -> ");
                    Serial.println(doc["val"].as<String>());

                    uploadToDatabase(incomingData);
                }

                // --- CASE 4: Sleep mode ---
                else if (doc.containsKey("mode") && doc["mode"] == "SLEEP") {
                    Serial.println("System is SLEEPING.");
                    uploadToDatabase(incomingData);
                }

            } else {
                Serial.print("JSON Error: ");
                Serial.println(error.c_str());
            }
        }
    }

    // Wi-Fi reconnect logic
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 5000) {
        lastCheck = millis();
        if (WiFi.status() != WL_CONNECTED && ssid != "") {
            Serial.println("Status: Connecting to Wi-Fi...");
            WiFi.begin(ssid.c_str(), password.c_str());
        }
    }
}

// Helper: send data to Vercel/MongoDB API
void uploadToDatabase(String jsonPayload) {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;

        // HTTPS support
        if (http.begin(serverName)) {
            http.addHeader("Content-Type", "application/json");

            int httpResponseCode = http.POST(jsonPayload);

            if (httpResponseCode > 0) {
                String response = http.getString();
                Serial.print("Upload Success code: ");
                Serial.println(httpResponseCode);
                Serial.println("Response: " + response);
            } else {
                Serial.print("Error on sending POST: ");
                Serial.println(httpResponseCode);
            }

            http.end();
        } else {
            Serial.println("Unable to connect to server!");
        }
    } else {
        Serial.println("Cannot Upload: No Wi-Fi");
    }
}

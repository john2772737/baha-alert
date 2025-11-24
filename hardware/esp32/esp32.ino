#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- ⚙️ CONFIGURATION & GLOBALS ---

// Pins for Serial2 on ESP32 (Used for communication with main sensor board)
#define RXD2 16
#define TXD2 17

// Your Vercel API URL (use HTTPS)
const char* serverName = "https://baha-alert.vercel.app/api";

// Global Variables for Wi-Fi credentials
String ssid = "";
String password = "";

// Global Variables for upload timing
unsigned long lastUploadTime = 0;
// Enforce a minimum delay of 60 seconds (1 minute) between database uploads
const long uploadInterval = 1500; 

// --- 🛠️ SETUP ---

void setup() {
    Serial.begin(115200);

    // Initialize Serial2 (GPIO 16/17) for communication with the main Arduino/sensor board
    Serial2.begin(9600, SERIAL_8N1, RXD2, TXD2); 

    Serial.println("\n\nESP32 Receiver Started...");
    Serial.println("Waiting for Arduino data on GPIO 16...");

    // Setup Wi-Fi mode
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(); 
}

// --- ⬆️ HELPER FUNCTION: Upload Data ---

/**
 * Helper: Sends the JSON payload to the Vercel/MongoDB API via HTTP POST.
 * Includes diagnostic prints for debugging connection errors.
 * @param jsonPayload The String containing the JSON data to be sent.
 */
void uploadToDatabase(String jsonPayload) {
    Serial.println("[UPLOAD] Checking Wi-Fi status before upload...");
    
    // CRITICAL CHECK POINT 1: Is Wi-Fi connected?
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("[UPLOAD] Wi-Fi is connected. Attempting POST to server...");
        HTTPClient http;

        // CRITICAL CHECK POINT 2: Can the HTTP connection be initiated?
        if (http.begin(serverName)) { // Initializes HTTPS connection
            http.addHeader("Content-Type", "application/json");
            
            // Log the payload size
            Serial.print("[UPLOAD] Payload size: ");
            Serial.print(jsonPayload.length());
            Serial.println(" bytes.");

            int httpResponseCode = http.POST(jsonPayload);

            if (httpResponseCode > 0) {
                String response = http.getString();
                Serial.print("[UPLOAD] Success Code: ");
                Serial.println(httpResponseCode);
                Serial.println("[UPLOAD] Response: " + response);
            } else {
                // If code is -1 (connection error, DNS failure) or other HTTP error
                Serial.print("[UPLOAD] Error on sending POST (Code): ");
                Serial.println(httpResponseCode);
                Serial.println("[UPLOAD] Hint: Code -1 often means connection timed out or DNS failure.");
            }

            http.end();
        } else {
            Serial.println("[UPLOAD] FATAL ERROR: Unable to initiate HTTP connection (DNS/server name issue or certificate failure).");
        }
    } else {
        Serial.println("[UPLOAD] Cannot Upload: Wi-Fi status is NOT connected.");
    }
}

// --- 🔄 MAIN LOOP ---

void loop() {
    // Check for incoming data from the Arduino on Serial2
    if (Serial2.available()) {
        String incomingData = Serial2.readStringUntil('\n');
        incomingData.trim();

        if (incomingData.length() > 0) {
            Serial.print("Raw Incoming Data: ");
            Serial.println(incomingData);

            StaticJsonDocument<512> doc;
            DeserializationError error = deserializeJson(doc, incomingData);

            if (!error) {
                
                // --- CASE 1: Wi-Fi Configuration Update (type: config) ---
                if (doc.containsKey("type") && doc["type"] == "config") {
                    ssid = doc["ssid"].as<String>();
                    password = doc["pass"].as<String>();

                    Serial.println("--- NEW WIFI CREDENTIALS RECEIVED ---");
                    Serial.print("SSID: "); Serial.println(ssid);
                    
                    // Attempt to connect immediately with the new credentials
                    WiFi.begin(ssid.c_str(), password.c_str());
                }

                // --- CASE 2 & 3: Sensor Data / Sleep Mode ---
                else if (doc.containsKey("mode")) {
                    
                    // ⏱️ TIMER CHECK: Only upload if the interval has passed
                    if (millis() - lastUploadTime >= uploadInterval) {
                        
                        if (doc["mode"] == "AUTO") {
                            Serial.println("--- DECODED SENSOR DATA ---");
                            Serial.printf("Pressure: %.2f hPa\n", doc["pressure"].as<float>());
                            Serial.println("Rain: " + doc["rain"].as<String>());
                            Serial.println("Water: " + doc["waterLevel"].as<String>());
                            Serial.println("Soil: " + doc["soil"].as<String>());
                            Serial.println("---------------------------");
                        } else if (doc["mode"] == "SLEEP") {
                            Serial.println("System is entering SLEEP mode.");
                        }

                        // Execute upload
                        Serial.println("[TIMER] Time elapsed. Attempting scheduled upload.");
                        uploadToDatabase(incomingData);
                        // Reset the timer
                        lastUploadTime = millis();
                        
                    } else {
                        // Upload is skipped
                        Serial.print("[TIMER] Upload skipped. Waiting ");
                        Serial.print((uploadInterval - (millis() - lastUploadTime)) / 1000);
                        Serial.println(" more seconds...");
                    }
                }
                
            } else {
                Serial.print("JSON Deserialization Error: ");
                Serial.println(error.c_str());
                Serial.println("Check the data format sent by the main Arduino!");
            }
        }
    }

    // --- Wi-Fi Reconnect Logic (checks every 5 seconds) ---
    static unsigned long lastCheck = 0;
    if (millis() - lastCheck > 5000) {
        lastCheck = millis();
        
        Serial.print("[WIFI] Current Status: ");
        Serial.println(WiFi.status()); // Print the actual status code
        
        // Only try to reconnect if not connected and we have valid SSID stored
        if (WiFi.status() != WL_CONNECTED && ssid != "") {
            Serial.println("[WIFI] Status: Attempting to reconnect...");
            WiFi.begin(ssid.c_str(), password.c_str());
        } else if (WiFi.status() == WL_CONNECTED) {
            // Optional: Print IP once connected
            Serial.print("[WIFI] Status: Connected! IP: ");
            Serial.println(WiFi.localIP());
        }
    }
}
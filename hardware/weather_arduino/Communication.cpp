#include "Communication.h"

// Constructor: Initializes the SoftwareSerial object using the Initializer List
Communication::Communication(int rxPin, int txPin) : _espSerial(rxPin, txPin) {
  _bufferIndex = 0;
}

void Communication::begin(long baudRate) {
  _espSerial.begin(baudRate);
}

// --- RECEIVING LOGIC ---

// This replaces your 'checkESPStatus' function
String Communication::listenForStatus() {
  String foundStatus = "";
  
  while (_espSerial.available()) {
    char inChar = _espSerial.read();

    // 1. Detect Start of Packet
    if (inChar == '{') {
      _bufferIndex = 0;
      _incomingBuffer[_bufferIndex++] = inChar;
    } 
    // 2. Buffer the data
    else if (_bufferIndex > 0 && _bufferIndex < 99) {
      _incomingBuffer[_bufferIndex++] = inChar;

      // 3. Detect End of Packet
      if (inChar == '}') {
        _incomingBuffer[_bufferIndex] = '\0'; // Null-terminate string
        
        // Deserialize JSON
        StaticJsonDocument<256> doc;
        DeserializationError error = deserializeJson(doc, _incomingBuffer);
        
        // Reset buffer for next time
        _bufferIndex = 0;

        // If valid JSON and has "status" key, return it
        if (!error && doc.containsKey("status")) {
           foundStatus = doc["status"].as<String>();
           return foundStatus; // Return immediately upon finding status
        }
      }
    }
  }
  return foundStatus; // Return empty if nothing found
}

// Passthrough for manual reading (used in Maintenance Mode)
int Communication::available() {
  return _espSerial.available();
}

char Communication::read() {
  return _espSerial.read();
}

// --- SENDING LOGIC ---

void Communication::sendSensorReport(String mode, float pressure, int rain, int soil, long distance) {
  StaticJsonDocument<256> doc;
  doc["mode"] = mode;
  doc["pressure"] = pressure;
  doc["rain"] = rain;
  doc["soil"] = soil;
  doc["waterDistanceCM"] = distance;

  char buffer[256];
  serializeJson(doc, buffer);
  _espSerial.println(buffer);
}

void Communication::sendSingleResponse(String sensor, float value) {
  // Manual string construction is often faster for small packets
  String json = "{\"sensor\":\"" + sensor + "\",\"val\":" + String(value, 2) + "}";
  _espSerial.println(json);
}

void Communication::sendSingleResponse(String sensor, String value) {
  String json = "{\"sensor\":\"" + sensor + "\",\"val\":\"" + value + "\"}";
  _espSerial.println(json);
}

void Communication::sendWifiConfig(String ssid, String pass) {
  // Using ArduinoJson here to ensure special characters in SSID/Pass are escaped correctly
  StaticJsonDocument<128> doc;
  doc["type"] = "config";
  doc["ssid"] = ssid;
  doc["pass"] = pass;
  
  char buffer[128];
  serializeJson(doc, buffer);
  _espSerial.println(buffer);
}

void Communication::sendMode(String modeName) {
  String json = "{\"mode\":\"" + modeName + "\"}";
  _espSerial.println(json);
}
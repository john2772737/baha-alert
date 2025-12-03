#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <Arduino.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>

class Communication {
  public:
    // Constructor: Defines the RX and TX pins for communication
    Communication(int rxPin, int txPin);
    
    // Start the serial connection
    void begin(long baudRate);

    // --- RECEIVING METHODS ---
    // Listens for JSON packets and returns the "status" string (e.g., "CONN_OK")
    // Returns empty string "" if no status packet is found.
    String listenForStatus();
    
    // Passthrough methods for Maintenance Mode manual reading
    int available();
    char read();

    // --- SENDING METHODS ---
    // Send the main sensor data packet (Auto Mode)
    void sendSensorReport(String mode, float pressure, int rain, int soil, long distance);
    
    // Send single sensor response (Maintenance Mode)
    void sendSingleResponse(String sensor, float value);
    void sendSingleResponse(String sensor, String value); // Overload for text/LED
    
    // Send Wi-Fi Credentials
    void sendWifiConfig(String ssid, String pass);
    
    // Send simple mode update
    void sendMode(String modeName);

  private:
    SoftwareSerial _espSerial; // The underlying serial object
    char _incomingBuffer[100]; // Buffer for incoming JSON
    byte _bufferIndex;         // Current position in buffer
};

#endif
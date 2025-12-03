#ifndef WIFICONFIG_H
#define WIFICONFIG_H

#include <Arduino.h>
#include <EEPROM.h>

// Define the maximum length for SSID and Password
#define CREDENTIAL_LIMIT 32

struct WifiCredentials {
  char ssid[CREDENTIAL_LIMIT];     
  char password[CREDENTIAL_LIMIT]; 
};

class WifiConfig {
  public:
    WifiConfig();

    // Check if valid credentials exist in EEPROM
    bool hasCredentials();

    // Load credentials into the provided char arrays
    void load(char* ssidBuffer, char* passBuffer);

    // Save new credentials to EEPROM
    void save(String newSSID, String newPass);

    // Clear credentials (optional, for security or reset)
    void clear();

  private:
    // The EEPROM address to start reading/writing
    const int _eepromAddress = 0;
};

#endif
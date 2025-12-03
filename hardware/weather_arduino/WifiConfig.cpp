#include "WifiConfig.h"

WifiConfig::WifiConfig() {
  // Constructor
}

bool WifiConfig::hasCredentials() {
  WifiCredentials creds;
  EEPROM.get(_eepromAddress, creds);

  // Check if the SSID is empty (0) or uninitialized (0xFF)
  if (creds.ssid[0] == 0 || creds.ssid[0] == 0xFF) {
    return false;
  }
  return true;
}

void WifiConfig::load(char* ssidBuffer, char* passBuffer) {
  WifiCredentials creds;
  EEPROM.get(_eepromAddress, creds);
  
  // Copy the data from the struct to the provided buffers
  strncpy(ssidBuffer, creds.ssid, CREDENTIAL_LIMIT);
  strncpy(passBuffer, creds.password, CREDENTIAL_LIMIT);
}

void WifiConfig::save(String newSSID, String newPass) {
  WifiCredentials creds;
  
  // 1. Clear the struct memory to avoid artifacts
  memset(creds.ssid, 0, CREDENTIAL_LIMIT);
  memset(creds.password, 0, CREDENTIAL_LIMIT);
  
  // 2. Convert Arduino Strings to char arrays safely
  newSSID.toCharArray(creds.ssid, CREDENTIAL_LIMIT);
  newPass.toCharArray(creds.password, CREDENTIAL_LIMIT);
  
  // 3. Write to EEPROM
  EEPROM.put(_eepromAddress, creds);
}

void WifiConfig::clear() {
  for (int i = 0; i < sizeof(WifiCredentials); i++) {
    EEPROM.write(_eepromAddress + i, 0);
  }
}
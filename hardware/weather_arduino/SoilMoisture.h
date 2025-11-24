#ifndef SOILMOISTURE_H
#define SOILMOISTURE_H

#include <Arduino.h>

class SoilMoisture {
  public:
    SoilMoisture(int analogPin);
    void begin();
    int getAnalog();
    String getCondition();   // <-- Added for readable soil condition

  private:
    int _analogPin;
};

#endif

#ifndef RainSensor_h
#define RainSensor_h
#include <Arduino.h>

class RainSensor {
  public:
    RainSensor(int analogPin);
    void begin();
    int getAnalog();
    String getCondition();   // <-- Added: Returns rain condition text
  
  private:
    int _analogPin;
};

#endif

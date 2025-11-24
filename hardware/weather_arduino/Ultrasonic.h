#ifndef ULTRASONIC_H
#define ULTRASONIC_H

#include <Arduino.h>

class Ultrasonic {
  public:
    // Constructor
    Ultrasonic(int trigPin, int echoPin);

    // Initialize pins
    void begin();

    // Get distance in centimeters
    long getDistanceCM();

    // Get water level condition: "Below Normal", "Normal", "Above Normal"
    String getCondition();

  private:
    int _trigPin;
    int _echoPin;
};

#endif

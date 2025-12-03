#ifndef SERVOGAUGE_H
#define SERVOGAUGE_H

#include <Arduino.h>
#include <Servo.h>

class ServoGauge {
  public:
    // Constructor: defined the pin the servo is connected to
    ServoGauge(int pin);
    
    // Attach the servo
    void begin();

    // Move the servo based on a sensor value
    // inputVal: The actual reading from the sensor
    // minSensor: The minimum expected value from the sensor (maps to 0 degrees)
    // maxSensor: The maximum expected value from the sensor (maps to 180 degrees)
    void update(float inputVal, float minSensor, float maxSensor);

    // Direct write (for testing)
    void write(int angle);

  private:
    int _pin;
    Servo _servo;
};

#endif
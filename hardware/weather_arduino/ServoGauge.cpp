#include "ServoGauge.h"

ServoGauge::ServoGauge(int pin) {
  _pin = pin;
}

void ServoGauge::begin() {
  _servo.attach(_pin);
  // Reset to 0 initially
  _servo.write(0);
}

void ServoGauge::update(float inputVal, float minSensor, float maxSensor) {
  // Constrain the input so the servo doesn't try to go beyond limits
  float constrainedVal = constrain(inputVal, minSensor, maxSensor);
  
  // Map the value to 0-180 degrees
  // logic: map(value, fromLow, fromHigh, toLow, toHigh)
  int angle = map(constrainedVal, minSensor, maxSensor, 0, 180);
  
  _servo.write(angle);
}

void ServoGauge::write(int angle) {
  _servo.write(angle);
}
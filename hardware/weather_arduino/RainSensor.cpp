#include "RainSensor.h"

RainSensor::RainSensor(int analogPin) {
  _analogPin = analogPin;
}

void RainSensor::begin() {
  pinMode(_analogPin, INPUT);
}

int RainSensor::getAnalog() {
  return analogRead(_analogPin);
}

String RainSensor::getCondition() {
  int value = getAnalog();

  if (value >= 600) {
    return "Completely dry (No rain)";
  } 
  else if (value >= 400 && value < 600) {
    return "Light rain / few drops";
  } 
  else if (value >= 200 && value < 400) {
    return "Moderate rain";
  } 
  else {
    return "Heavy rain / wet";
  }
}

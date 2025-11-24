#include "SoilMoisture.h"

SoilMoisture::SoilMoisture(int analogPin) {
  _analogPin = analogPin;
}

void SoilMoisture::begin() {
  pinMode(_analogPin, INPUT);
}

int SoilMoisture::getAnalog() {
  return analogRead(_analogPin);
}

String SoilMoisture::getCondition() {
  int value = getAnalog();

  if (value > 600) {
    return "Dry";
  } else {
    return "Wet";
  }
}

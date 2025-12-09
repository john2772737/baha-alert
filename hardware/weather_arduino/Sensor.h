#ifndef SENSOR_H
#define SENSOR_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP280.h> // Back to the reliable library

class Sensor {
  public:
    Sensor(int trigPin, int echoPin, int soilPin, int rainPin);
    void begin();
    void BMP180(); 
    float bmpPressure(); 

    long ultrasonicDistance();
    int soilAnalog();
    int rainAnalog();

  private:
    int _trigPin;
    int _echoPin;
    int _soilPin;
    int _rainPin;
    
    Adafruit_BMP280 bmp; // The Adafruit Object
};

#endif
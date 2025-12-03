#ifndef SENSOR
#define SENSOR

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>  

class Sensor {
  public:
    // Constructor
    Sensor(int trigPin, int echoPin,int soilPin,int rainPin);
    
    
    // Initialize pins
    void begin();

    //bpm180
    void BMP180();
    float bmpPressure();

    // ultrasonic 
    long ultrasonicDistance();

    //Soil Mosture
    int soilAnalog();

    //Rain Sensor
    int rainAnalog();

    

  private:
    int _trigPin;
    int _echoPin;
    int _soilPin;
    int _rainPin;
};

#endif

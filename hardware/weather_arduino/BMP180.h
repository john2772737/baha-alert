#ifndef BMP180_H
#define BMP180_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>  

class BMP180 {
public:
    BMP180();
    void begin();
    float getPressureHPA();   

private:
    Adafruit_BMP085 bmp;    
};

#endif

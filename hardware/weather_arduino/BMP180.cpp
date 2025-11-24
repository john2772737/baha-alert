#include "BMP180.h"

BMP180::BMP180() {}

void BMP180::begin() {
    if (!bmp.begin()) {
        Serial.println("Could not find BMP180 sensor!");
        while (1);
    }
}

float BMP180::getPressureHPA() {
    // Adafruit library returns Pa (Pascals)
    float pressure = bmp.readPressure();
    return pressure / 100.0; // Convert to hPa
}



#include "Sensor.h"

Sensor::Sensor(int trigPin, int echoPin, int soilPin, int rainPin) {
  _trigPin = trigPin;
  _echoPin = echoPin;
  _soilPin = soilPin;
  _rainPin = rainPin;
}

void Sensor::begin() {
  pinMode(_trigPin, OUTPUT);
  pinMode(_echoPin, INPUT);
}

void Sensor::BMP180() {
  // Try to initialize at 0x76 first
  if (!bmp.begin(0x76)) {
    Serial.println(F("BMP Init Fail")); // F() macro saves memory
  }

  // OPTIMIZATION: Set sampling to lower precision to save power/time if needed, 
  // but standard settings are fine.
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,     
                  Adafruit_BMP280::SAMPLING_X2,     
                  Adafruit_BMP280::SAMPLING_X16,    
                  Adafruit_BMP280::FILTER_X16,      
                  Adafruit_BMP280::STANDBY_MS_500); 
}

float Sensor::bmpPressure() {
  float pressure = bmp.readPressure(); // Reads in Pa
  if (isnan(pressure) || pressure == 0) return -1.0;
  return pressure / 100.0; // Convert to hPa
}

long Sensor::ultrasonicDistance() {
  digitalWrite(_trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(_trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(_trigPin, LOW);
  long duration = pulseIn(_echoPin, HIGH);
  return (duration * 0.0343) / 2;
}

int Sensor::soilAnalog() { return analogRead(_soilPin); }
int Sensor::rainAnalog() { return analogRead(_rainPin); }
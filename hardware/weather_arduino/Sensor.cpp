#include "Sensor.h"

// Create an instance of the BMP driver
// Note: This is defined here because it wasn't declared in the private members of the header
Adafruit_BMP085 bmp;

// Constructor: Assigns the pin numbers to private variables
Sensor::Sensor(int trigPin, int echoPin, int soilPin, int rainPin) {
  _trigPin = trigPin;
  _echoPin = echoPin;
  _soilPin = soilPin;
  _rainPin = rainPin;
}

// Initialize the Pins
void Sensor::begin() {
  pinMode(_trigPin, OUTPUT);
  pinMode(_echoPin, INPUT);
  
  // Note: _soilPin and _rainPin do not require pinMode if using analogRead()
  // However, if you are using them as digital inputs, uncomment below:
  // pinMode(_soilPin, INPUT);
  // pinMode(_rainPin, INPUT);
}

// Initialize the BMP180 Sensor
// NOTE: Your header lacked a return type for this. I assumed 'void'.
void Sensor::BMP180() {
  if (!bmp.begin()) {
    // If you have Serial initialized in your main sketch, this will help debug
    Serial.println("Could not find a valid BMP085/180 sensor, check wiring!");
  }
}

// Read Pressure from BMP180
float Sensor::bmpPressure() {
  return bmp.readPressure();
}

// Read distance from Ultrasonic Sensor in CM
long Sensor::ultrasonicDistance() {
  // 1. Clear the trigger
  digitalWrite(_trigPin, LOW);
  delayMicroseconds(2);
  
  // 2. Trigger the sensor by sending a high pulse for 10 microseconds
  digitalWrite(_trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(_trigPin, LOW);
  
  // 3. Read the echoPin, returns the sound wave travel time in microseconds
  long duration = pulseIn(_echoPin, HIGH);
  
  // 4. Calculate distance in Centimeters
  // Formula: Distance = (Duration * Speed of Sound) / 2
  // Speed of sound is ~343m/s, which is 0.0343 cm/microsecond
  // We divide by 2 because the sound goes out and comes back (round trip)
  long distance = (duration * 0.0343) / 2;
  
  return distance;
}

// Read Analog Soil Moisture
int Sensor::soilAnalog() {
  return analogRead(_soilPin);
}

// Read Analog Rain Sensor
int Sensor::rainAnalog() {
  return analogRead(_rainPin);
}
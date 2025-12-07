#include "ServoControl.h"

ServoControl::ServoControl(int pin) {
  _servoPin = pin;
  _stopPoint = 90; // Default stop point for continuous servos
}

void ServoControl::begin() {
  _servo.attach(_servoPin);
  stop(); // Ensure it doesn't spin on startup
}

void ServoControl::stop() {
  _servo.write(_stopPoint);
}

// Logic for Potentiometer Control (0-1023 input)
void ServoControl::driveFromAnalog(int sensorValue) {
  // Map 0-1023 to 0-180
  int speedCommand = map(sensorValue, 0, 1023, 0, 180);

  // DEAD ZONE LOGIC
  // If the value is close to 90, force it to exactly 90 to stop jitter
  if (speedCommand > 85 && speedCommand < 95) {
    speedCommand = _stopPoint;
  }

  _servo.write(speedCommand);
}

// Logic for Automatic Control (-100 to 100 input)
void ServoControl::driveSpeed(int speed) {
  // Constrain input to valid percentages
  speed = constrain(speed, -100, 100);
  
  // Map -100 (Max Reverse) to 0
  // 0 (Stop) to 90
  // 100 (Max Forward) to 180
  int pwmVal = map(speed, -100, 100, 0, 180);
  
  _servo.write(pwmVal);
}
#ifndef SERVOCONTROL_H
#define SERVOCONTROL_H

#include <Arduino.h>
#include <Servo.h>

class ServoControl {
  private:
    Servo _servo;
    int _servoPin;
    int _stopPoint; // Usually 90, but can be calibrated

  public:
    ServoControl(int pin);
    void begin();
    
    // Drive using raw analog sensor data (0-1023)
    // Useful for potentiometer control
    void driveFromAnalog(int sensorValue);

    // Drive using explicit speed (-100 to 100)
    // Useful for automated commands (e.g., "Open", "Close")
    void driveSpeed(int speed); // -100 (Full CCW), 0 (Stop), 100 (Full CW)

    void stop();
};

#endif
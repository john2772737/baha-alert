#include "Ultrasonic.h"

Ultrasonic::Ultrasonic(int trigPin, int echoPin) {
  _trigPin = trigPin;
  _echoPin = echoPin;
}

void Ultrasonic::begin() {
  pinMode(_trigPin, OUTPUT);
  pinMode(_echoPin, INPUT);
}

long Ultrasonic::getDistanceCM() {
  // Send trigger pulse
  digitalWrite(_trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(_trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(_trigPin, LOW);


  long duration = pulseIn(_echoPin, HIGH, 30000); 
  if (duration == 0) return 9999; 


  long distance = duration * 0.034 / 2;
  return distance;
}

String Ultrasonic::getCondition() {
  long distance = getDistanceCM();

  const long aboveNormalThreshold = 10;  // distance <= 10 → Above Normal
  const long belowNormalThreshold = 25;  // distance > 25 → Below Normal

  if (distance <= aboveNormalThreshold) {
    return "Above Normal";  
  } 
  else if (distance > aboveNormalThreshold && distance <= belowNormalThreshold) {
    return "Normal"; }      
  else {
    return "Below Normal";   
  }
}

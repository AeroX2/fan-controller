#include <RCSwitch.h>

enum Buttons {
  LIGHT,
  FAN_OFF,
  FAN_LOW,
  FAN_MED,
  FAN_HIGH,
};

#define CHANNEL "1011"
#define PRE "0" CHANNEL "1"
const char* button_commands[] = { 
  PRE "111110",
  PRE "111101",
  PRE "110111",
  PRE "101111",
  PRE "011111"
};

RCSwitch radio = RCSwitch();

void setup() {
  Serial.begin(9600);

  pinMode(6, INPUT);
  
  radio.enableTransmit(10);
  radio.setProtocol(6);
  radio.setPulseLength(350);
  radio.setRepeatTransmit(5);

  Serial.println("Done starting up");
}

void loop() {
  while (Serial.available()) {
    String command = Serial.readString();
    if (command == "LIGHT") {
      Serial.println("Activating light");
      radio.send(button_commands[LIGHT]);
    } else if (command == "OFF") {
      Serial.println("Activating off");
      radio.send(button_commands[FAN_OFF]);
    } else if (command == "LOW") {
      Serial.println("Activating low");
      radio.send(button_commands[FAN_LOW]);
    } else if (command == "MED") {
      Serial.println("Activating med");
      radio.send(button_commands[FAN_MED]);
    } else if (command == "HIGH") {
      Serial.println("Activating high");
      radio.send(button_commands[FAN_HIGH]);
    }
  }

  if (digitalRead(6) == HIGH) {
    Serial.println("Button pushed, turning on light");
    radio.send(button_commands[LIGHT]);
  }
}

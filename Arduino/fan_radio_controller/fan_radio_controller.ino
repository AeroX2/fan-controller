#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <DNSServer.h>
#include <WiFiClient.h>
#include <WiFiManager.h>  
#include <ArduinoJson.h>
#include <RCSwitch.h>
#include <Time.h>
#include <TimeAlarms.h>


enum Buttons {
  LIGHT,
  FAN_OFF,
  FAN_LOW,
  FAN_MED,
  FAN_HIGH,
};

#define RADIO_PIN D7
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
ESP8266WebServer server(80);

void stop_fan() {
  Serial.println("Stopping fan, alarm has gone off");
  radio.send(button_commands[FAN_OFF]);

  // Some versions of RC Switch don't drive the pin LOW making a lot of radio noise.
  digitalWrite(RADIO_PIN, LOW);
}

// curl -i -X POST -d '{"command": "off"}' http://192.168.2.65/control
void post_control() {
  StaticJsonBuffer<512> json_buffer;
  String post_body = server.arg("plain");
  Serial.println(post_body);

  JsonObject& json_body = json_buffer.parseObject(server.arg("plain"));
  
  if (!json_body.success()) {
      Serial.println("Error parsing JSON body");
      server.send(400);
      return;
  }

  const char* command = json_body["command"];
  if (command == nullptr) {
      Serial.println("Command not found in JSON body");
      server.send(400);
      return;
  }

  // Send the response, now so the Android app reacts a little quicker
  server.send(200, "application/json", "{\"response\": \"OK\"}");
  
  if (strcmp(command, "light") == 0) {
    Serial.println("Turning on the light");
    radio.send(button_commands[LIGHT]);
  } else if (strcmp(command, "off") == 0) {
    Serial.println("Turning fan off");
    radio.send(button_commands[FAN_OFF]);
  } else if (strcmp(command, "low") == 0) {
    Serial.println("Turning fan on low");
    radio.send(button_commands[FAN_LOW]);
  } else if (strcmp(command, "medium") == 0) {
    Serial.println("Turning fan on medium");
    radio.send(button_commands[FAN_MED]);
  } else if (strcmp(command, "high") == 0) {
    Serial.println("Turning fan on high");
    radio.send(button_commands[FAN_HIGH]);
  }

  // Some versions of RC Switch don't drive the pin LOW making a lot of radio noise.
  digitalWrite(RADIO_PIN, LOW);
  
  if (json_body.containsKey("timeout")) {
    int hours = json_body["timeout"]["hours"];
    int minutes = json_body["timeout"]["minutes"];
    int seconds = json_body["timeout"]["seconds"];
    
    char format_string[512];
    sprintf(format_string, "Timeout found, setting alarm for %02d:%02d:%02d", hours, minutes, seconds);
    Serial.println(format_string);
    Alarm.timerOnce(60*60*hours+60*minutes+seconds, stop_fan);
  }
}

void setup(void) {
  Serial.begin(115200);
  
  WiFi.hostname("james_fan_controller");
  WiFiManager wifiManager;
  wifiManager.autoConnect();
  
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(WiFi.SSID());
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  radio.enableTransmit(RADIO_PIN);
  radio.setProtocol(6);
  radio.setPulseLength(350);
  radio.setRepeatTransmit(5);

  server.on("/", []() {
    server.send(200, "application/json", "{\"response\": \"James's Fan controller\"}");
  });
  server.on("/control", HTTP_POST, post_control);

  server.begin();
  Serial.println("HTTP server started");
}

void loop(void) {
  server.handleClient();
  Alarm.delay(100);
}

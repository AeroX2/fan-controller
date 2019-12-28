#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
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

#define DISCOVERY_PORT_IN  3311
#define DISCOVERY_PORT_OUT 3312
char incoming_packet[256];
WiFiUDP Udp;

RCSwitch radio = RCSwitch();
ESP8266WebServer server(80);

void stop_fan() {
  Serial.println("Stopping fan, alarm has gone off");

  // Send three times for "safety"
  radio.send(button_commands[FAN_OFF]);
  radio.send(button_commands[FAN_OFF]);
  radio.send(button_commands[FAN_OFF]);

  // Some versions of RC Switch don't drive the pin LOW making a lot of radio noise.
  digitalWrite(RADIO_PIN, LOW);
}

// curl -i -X POST -d '{"command": "off"}' http://192.168.2.65/control
AlarmID_t alarm_id = -1;
void post_control() {
  StaticJsonDocument<512> json_doc;
  String post_body = server.arg("plain");
  Serial.println(post_body);

  auto error = deserializeJson(json_doc, server.arg("plain"));
  if (error) {
      Serial.println("Error parsing JSON body");
      server.send(400);
      return;
  }

  const char* command = json_doc["command"];
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
    radio.send(button_commands[LIGHT]);
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
  } else if (strcmp(command, "pause") == 0) {
    Serial.println("Pausing timer");
  	if (alarm_id != -1) {
  	  Alarm.disable(alarm_id);
  	} 
  } else if (strcmp(command, "resume") == 0) {
    Serial.println("Resuming timer");
    if (alarm_id != -1) {
      Alarm.enable(alarm_id);
    }
  }

  // Some versions of RC Switch don't drive the pin LOW making a lot of radio noise.
  digitalWrite(RADIO_PIN, LOW);
  
  if (json_doc.containsKey("timeout")) {
    long hours = 0;
    long minutes = 0;
    long seconds = 0;
    if (json_doc["timeout"].is<long>()) {
      seconds = json_doc["timeout"];
    } else {
      hours = json_doc["timeout"]["hours"];
      minutes = json_doc["timeout"]["minutes"];
      seconds = json_doc["timeout"]["seconds"];
    }
    
    char format_string[512];
    sprintf(format_string, "Timeout found, setting alarm for %02d:%02d:%02d", hours, minutes, seconds);
    Serial.println(format_string);
    alarm_id = Alarm.timerOnce(60*60*hours+60*minutes+seconds, stop_fan);
  }
}

void process_discovery_packets() {
  int packetSize = Udp.parsePacket();
  if (packetSize) {
    // Receive incoming UDP packets
    Serial.printf("Received %d bytes from %s, port %d\n", packetSize, Udp.remoteIP().toString().c_str(), Udp.remotePort());
    int len = Udp.read(incoming_packet, 255);
    if (len > 0) {
      incoming_packet[len] = 0;
    }
    Serial.printf("UDP packet contents: %s\n", incoming_packet);

    if (memcmp(incoming_packet, "\xA5\xA5\xA5\xA5", 4) != 0) {
      Serial.println("Unknown UDP discovery packet data receivied");
      return;
    }

    // Send back a reply, to the IP address and port we got the packet from
    Udp.beginPacket(Udp.remoteIP(), DISCOVERY_PORT_OUT);
    Udp.write("james_fan_controller");
    Udp.endPacket();
  }
}

void setup(void) {
  Serial.begin(115200);
  
  // WiFi.hostname("");
  WiFiManager wifiManager;
  wifiManager.autoConnect();
  
  Serial.println("");
  Serial.print("Connected to ");
  Serial.println(WiFi.SSID());
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  Udp.begin(DISCOVERY_PORT_IN);
  Serial.printf("UDP Discovery Started on: %d\n", DISCOVERY_PORT_IN);
  
  radio.enableTransmit(RADIO_PIN);
  radio.setProtocol(6);
  radio.setPulseLength(350);
  radio.setRepeatTransmit(5);

  server.on("/", []() {
    server.send(200, "application/json", "{\"response\": \"James's Fan controller\"}");
  });
  server.on("/control", HTTP_POST, post_control);

  server.begin();
  Serial.printf("HTTP server started on: %d\n", 80);
}

void loop(void) {
  process_discovery_packets();
  server.handleClient();
  Alarm.delay(10);
}

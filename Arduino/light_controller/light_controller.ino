
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include <DNSServer.h>
#include <WiFiClient.h>
#include <WiFiManager.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>
#include <Time.h>
#include <TimeAlarms.h>

#define RELAY_PIN 4

#define DISCOVERY_PORT_IN  3311
#define DISCOVERY_PORT_OUT 3312

int count = 0;
char debugging[20][100];
char incoming_packet[256];

WiFiUDP Udp;

ESP8266WebServer server(80);

// curl -i -X POST -d '{"command": "light"}' http://192.168.2.65/control
boolean light = false;
AlarmID_t alarm_id = -1;
void post_control() {
  StaticJsonDocument<512> json_doc;
  String post_body = server.arg("plain");
  //Serial.println(post_body);

  auto error = deserializeJson(json_doc, server.arg("plain"));
  if (error) {
      //Serial.println("Error parsing JSON body");
      server.send(400);
      return;
  }

  const char* command = json_doc["command"];
  if (command == nullptr) {
      //Serial.println("Command not found in JSON body");
      server.send(400);
      return;
  }

  // Send the response, now so the Android app reacts a little quicker
  server.send(200, "application/json", "{\"response\": \"OK\"}");
  
  if (strcmp(command, "light") == 0) {
    //Serial.println("Toggling the light");
    light = !light;
    digitalWrite(RELAY_PIN, light);
  }
}

void process_discovery_packets() {
  int packetSize = Udp.parsePacket();
  if (packetSize) {
    // Receive incoming UDP packets
    //Serial.printf("Received %d bytes from %s, port %d\n", packetSize, Udp.remoteIP().toString().c_str(), Udp.remotePort());
    int len = Udp.read(incoming_packet, 255);
    if (len > 0) {
      incoming_packet[len] = 0;
    }
    //Serial.printf("UDP packet contents: %s\n", incoming_packet);

    IPAddress remote = Udp.remoteIP();
    if (memcmp(incoming_packet, "\xA5\xA5\xA5\xA5", 4) != 0) {
      sprintf(debugging[count % 20], "Unknown [%d][%d][%d][%d] from %d.%d.%d.%d", 
        incoming_packet[0],
        incoming_packet[1],
        incoming_packet[2],
        incoming_packet[3],
        remote[0],
        remote[1],
        remote[2],
        remote[3]
      );
      count++;
      //Serial.println("Unknown UDP discovery packet data receivied");
      return;
    }
    sprintf(debugging[count % 20], "Known reply from %d.%d.%d.%d",
        remote[0],
        remote[1],
        remote[2],
        remote[3]
    );
    count++;

    // Send back a reply, to the IP address and port we got the packet from
    Udp.beginPacket(remote, DISCOVERY_PORT_OUT);
    Udp.write("james_light_controller");
    Udp.endPacket();
  }
}

void setup(void) {
  //Serial.begin(115200);
  
  WiFiManager wifiManager;
  wifiManager.autoConnect();
  
  WiFi.hostname("light_controller");
  //Serial.println("");
  //Serial.print("Connected to ");
  //Serial.println(WiFi.SSID());
  //Serial.print("IP address: ");
  //Serial.println(WiFi.localIP());

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  
  Udp.begin(DISCOVERY_PORT_IN);
  //Serial.printf("UDP Discovery Started on: %d\n", DISCOVERY_PORT_IN);

  server.on("/", []() {
    server.send(200, "application/json", "{\"response\": \"James's Light controller\"}");
  });
  server.on("/debug", []() {
    char final[20*100 + 100];
    sprintf(final, "{\"response\": [");
    for (int i = 0; i < count % 20; i++) {
      if (i != 0) strcat(final, ",");
      strcat(final, "\"");
      strcat(final, debugging[i]);
      strcat(final, "\"");
    }
    strcat(final, "]}");
    server.send(200, "application/json", final);
  });
  server.on("/control", HTTP_POST, post_control);

  server.begin();
  //Serial.printf("HTTP server started on: %d\n", 80);

  ArduinoOTA.setPassword("failsafe_password");
  ArduinoOTA.setHostname("light_controller");
  ArduinoOTA.onStart([]() {
    Serial.println("Start");
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\nEnd");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });
  ArduinoOTA.begin();
}

void loop(void) {
  process_discovery_packets();
  server.handleClient();
  ArduinoOTA.handle();
}

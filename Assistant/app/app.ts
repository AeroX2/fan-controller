/// <reference types="@google/local-home-sdk" />

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device execution.
export class HomeApp {
    constructor(private readonly app: smarthome.App) {
        this.app = app;
    }

    public identifyHandler = async (identifyRequest: smarthome.IntentFlow.IdentifyRequest):	
    Promise<smarthome.IntentFlow.IdentifyResponse> => {

        console.log("IDENTIFY request", identifyRequest);

        const device = identifyRequest.inputs[0].payload.device;
        if (device === undefined) {
            throw Error(`device is undefined: ${identifyRequest}`);
        }
        if (device.udpScanData === undefined) {
            throw Error(`identify request is missing discovery response: ${identifyRequest}`);
        }

        // Raw discovery data are encoded as 'hex'.
        const udpScanData = Buffer.from(device.udpScanData.data, "hex");
        console.debug("udpScanData:", udpScanData);
        // Device encoded discovery payload in CBOR.
        const discoveryId = udpScanData.toString();
        console.debug("discoveryData:", discoveryId);

        const identifyResponse: smarthome.IntentFlow.IdentifyResponse = {
            intent: smarthome.Intents.IDENTIFY,
            requestId: identifyRequest.requestId,
            payload: {
                device: {
                    id: device.id || "deviceId", 
                    verificationId: discoveryId 
                },
            },
        };
        console.log("IDENTIFY response", identifyResponse);
        return identifyResponse;
    }

    public executeHandler = (request: smarthome.IntentFlow.ExecuteRequest): 
        Promise<smarthome.IntentFlow.ExecuteResponse> => {

        // Extract command(s) and device target(s) from request
        const command = request.inputs[0].payload.commands[0];
        const execution = command.execution[0];
        const params = execution.params as {
            fanState: string,
            timerTimeSec: string,
        };

        const response = new smarthome.Execute.Response.Builder()
            .setRequestId(request.requestId);

        const result = command.devices.map((device: smarthome.IntentFlow.DeviceMetadata) => {
            const postData = {
                command: "",
            } as {
                command: string,
                timeout: number|undefined
            };

            switch (execution.command) {
            case "action.devices.commands.SetFanSpeed":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                if (["off", "low", "medium", "high"].indexOf(params.fanState) === -1) {
                    throw Error(`Unrecognised fan state: ${params.fanState}`);
                }
                postData.command = params.fanState;
                break;
            case "action.devices.commands.SetToggles":
                postData.command = "light";
                break;
            case "action.devices.commands.TimerStart":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                postData.timeout = parseInt(params.timerTimeSec);
                break;
            case "action.devices.commands.TimerAdjust":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                postData.timeout = parseInt(params.timerTimeSec);
                break;
            case "action.devices.commands.TimerPause":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                postData.command = "pause";
                break;
            case "action.devices.commands.TimerResume":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                postData.command = "resume";
                break;
            case "action.devices.commands.TimerCancel":
                if (device.id === "james_light_controller") {
                    console.error("Wrong command for device id", execution.command);
                }

                postData.command = "pause";
                break;
            default:
                throw Error(`Unsupported command: ${execution.command}`);
            }

            // Create HTTP Command
            const deviceCommand = new smarthome.DataFlow.HttpRequestData();
            deviceCommand.requestId = request.requestId;
            deviceCommand.deviceId = device.id;
            deviceCommand.method = smarthome.Constants.HttpOperation.POST;
            deviceCommand.port = 80;
            deviceCommand.path = "/control";
            deviceCommand.dataType = "application/json";
            deviceCommand.data = JSON.stringify(postData);

            console.debug("HttpRequestData:", deviceCommand);

            // Send command to the local device
            return this.app.getDeviceManager()
                .send(deviceCommand)
                .then((result) => {
                    response.setSuccessState(result.deviceId, {});
                })
                .catch((err: smarthome.IntentFlow.HandlerError) => {
                    err.errorCode = err.errorCode || smarthome.IntentFlow.ErrorCode.INVALID_REQUEST;
                    response.setErrorState(device.id, err.errorCode);
                });
        });

        // Respond once all commands complete
        return Promise.all(result)
            .then(() => response.build());
    };
}

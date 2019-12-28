/// <reference types="@google/local-home-sdk" />

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device execution.
export class HomeApp {
	constructor(private readonly app: smarthome.App) {
		this.app = app;
	}

	public identifyHandler = async (identifyRequest: smarthome.IntentFlow.IdentifyRequest):	Promise<smarthome.IntentFlow.IdentifyResponse> => {
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

	// executeHandler send openpixelcontrol messages corresponding to light device commands.
	public executeHandler = async (executeRequest: smarthome.IntentFlow.ExecuteRequest): Promise<smarthome.IntentFlow.ExecuteResponse> => {
		console.log("EXECUTE request:", executeRequest);
		// TODO(proppy): handle multiple inputs/commands.
		const command = executeRequest.inputs[0].payload.commands[0];
		// TODO(proppy): handle multiple executions.
		const execution = command.execution[0];
		const params = execution.params as any;

		let postData = {
			command: ""
		} as any;
		switch (execution.command) {
			case "action.devices.commands.SetFanSpeed":
				const fanState = params.fanSpeed;
				if (["low", "medium", "high"].indexOf(fanState) === -1) {
					throw Error(`Unrecognised fan state: ${fanState}`);
				}
				postData.command = fanState;
				break
			case "action.devices.commands.OnOff":
				postData.command = "light"
				break
			case "action.devices.commands.TimerStart":
				postData.timeout = parseInt(params.timerTimeSec);
				break
			case "action.devices.commands.TimerAdjust":
				postData.timeout = parseInt(params.timerTimeSec);
				break
			case "action.devices.commands.TimerPause":
				postData.command = "pause"
				break
			case "action.devices.commands.TimerResume":
				postData.command = "resume"
				break
			case "action.devices.commands.TimerCancel":
				postData.command = "pause"
				break
			default:
				throw Error(`Unsupported command: ${execution.command}`);
		}

		// Create execution response to capture individual command
		// success/failure for each devices.
		const executeResponse = new smarthome.Execute.Response.Builder()
			.setRequestId(executeRequest.requestId);
		// Handle light device commands for all devices.
		await Promise.all(command.devices.map(async (device: any) => {
			// Create HTTP Command
			const httpRequest = new smarthome.DataFlow.HttpRequestData();
			httpRequest.requestId = executeRequest.requestId;
			httpRequest.deviceId = device.id;
			httpRequest.method = smarthome.Constants.HttpOperation.POST;
			httpRequest.port = 80;
			httpRequest.path = '/control';
			httpRequest.dataType = 'application/json';
			httpRequest.data = JSON.stringify(postData);

			console.debug("HttpRequestData:", httpRequest);
			try {
				const result = await this.app.getDeviceManager().send(httpRequest);
				const state = {
					online: true
				};
				executeResponse.setSuccessState(result.deviceId, state);
			} catch (e) {
				executeResponse.setErrorState(device.id, e.errorCode);
			}
		}));

		console.log("EXECUTE response", executeResponse);
		// Return execution response to smarthome infrastructure.
		return executeResponse.build();
	}
}

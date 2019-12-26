/// <reference types="@google/local-home-sdk" />

import { IColorAbsolute, IDiscoveryData, ICustomData, IStrandInfo } from "./types";

// TODO(proppy): add typings
const cbor = require("cbor");
const opcStream = require("opc");

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device execution.
export class HomeApp {
	constructor(private readonly app: smarthome.App) {
		this.app = app;
	}

	// identifyHandlers decode UDP scan data and structured device information.
	public identifyHandler = async (identifyRequest: smarthome.IntentFlow.IdentifyRequest):
	Promise<smarthome.IntentFlow.IdentifyResponse> => {
		console.log("IDENTIFY request", identifyRequest);

		const device = identifyRequest.inputs[0].payload.device;
		if (device === undefined) {
			throw Error(`device is undefined: ${identifyRequest}`);
		}
		if (device.mdnsScanData === undefined) {
			throw Error(`identify request is missing discovery response: ${identifyRequest}`);
		}

		const scanData = device.mdnsScanData;
		const localDeviceId = scanData.txt.myParameter;
		console.log("Local device", scanData);

		const identifyResponse: smarthome.IntentFlow.IdentifyResponse = {
			intent: smarthome.Intents.IDENTIFY,
			requestId: identifyRequest.requestId,
			payload: {
				device: {
					id: device.id as string
				},
			},
		};
		console.log("IDENTIFY response", identifyResponse);
		return identifyResponse;
	}

	public reachableDevicesHandler = async (reachableDevicesRequest: smarthome.IntentFlow.ReachableDevicesRequest):	Promise<smarthome.IntentFlow.ReachableDevicesResponse> => {
		console.log("REACHABLE_DEVICES request:", reachableDevicesRequest);

		const proxyDeviceId = reachableDevicesRequest.inputs[0].payload.device.id;
		const devices = reachableDevicesRequest.devices.flatMap((d: any) => {
			const customData =  d.customData as ICustomData;
			if (customData.proxy === proxyDeviceId) {
				return [{ verificationId: `${proxyDeviceId}-${customData.channel}`}];
			}
			return [];
		});
		const reachableDevicesResponse = {
			intent: smarthome.Intents.REACHABLE_DEVICES,
			requestId: reachableDevicesRequest.requestId,
			payload: {
				devices,
			},
		};
		console.log("REACHABLE_DEVICES response", reachableDevicesResponse);
		return reachableDevicesResponse;
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
				if (fanState == "S1") {
					postData.command = "low"
				} else if (fanState == "S2") {
					postData.command = "medium"
				} else if (fanState == "S3") {
					postData.command = "high"
				} else {
					throw Error(`Unrecognised fan state: ${fanState}`);
				}
				break
			case "action.devices.commands.OnOff":
				postData.command = "light"
				break
			case "action.devices.commands.TimerStart":
				postData.timeout = parseInt(params.timerRemainingSec);
				break
			case "action.devices.commands.TimerAdjust":
				postData.timeout = parseInt(params.timerRemainingSec);
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

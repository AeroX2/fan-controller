import * as functions from "firebase-functions";
import { smarthome } from "actions-on-google";
import "ts-polyfill/lib/es2019-array";

const config = functions.config();
const devices = Object.entries(config).flatMap(([deviceId, deviceConf]: [string, any]) => {
	const channels = deviceConf.channel ? deviceConf.channel.split(",") : ["1"];
	const proxy = channels.length > 1 ? deviceId : undefined;
	return channels.map((c: string) => ({
		id: proxy ? `${deviceId}-${c}` : deviceId,
		name: `${deviceId} #${c}`,
		channel: parseInt(c, 10),
		proxy,
	}));
});

const app = smarthome({debug: true});

app.onSync((body, headers) => {
	return {
		requestId: body.requestId,
		payload: {
			agentUserId: "placeholder-user-id",
			devices: devices.map((device: any) => ({
				type: "action.devices.types.FAN",
				traits: [
					"action.devices.traits.FanSpeed",
					"action.devices.traits.Timer",
					"action.devices.traits.OnOff"
				],
				id: device.id,
				otherDeviceIds: [{
					deviceId: device.id,
				}],
				name: {
					name: device.name,
					defaultNames: [],
					nicknames: [],
				},
				willReportState: false,
				attributes: {
					availableFanSpeeds: {
						speeds: [{
							speed_name: 'Low',
							speed_values: [{
								speed_synonym: ['low', 'slow'],
								lang: 'en'
							}]
						}, {
							speed_name: 'Medium',
							speed_values: [{
								speed_synonym: ['medium', 'half', 'half-speed', 'half speed'],
								lang: 'en'
							}]
						}, {
							speed_name: 'High',
							speed_values: [{
								speed_synonym: ['high', 'fast', 'full'],
								lang: 'en'
							}]
						}],
						ordered: true
					},
					reversible: false,
					maxTimerLimitSec: 36000,
					commandOnlyTimer: true
				},
				customData: {
					channel: device.channel,
					port: device.port,
					proxy: device.proxy,
				},
			})),
		},
	};
});
app.onQuery((body, headers) => {
	return {
		requestId: body.requestId,
		payload: {
			devices: [],
		},
	};
});
exports.smarthome = functions.https.onRequest(app);

exports.authorize = functions.https.onRequest((req, res) => {
	res.status(200).send(`<a href="${decodeURIComponent(req.query.redirect_uri)}?code=placeholder-auth-code&state=${req.query.state}">Complete Account Linking</a>`);
});

exports.token = functions.https.onRequest((req, res) => {
	res.status(200).send({
		token_type: "bearer",
		access_token: "placeholder-access-token",
		refresh_token: "placeholder-refresh-token",
		expires_in: 3600,
	});
});

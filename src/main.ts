/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import type { LibraryStateVal } from './lib/library.js';
// eslint-disable-next-line
import { Library, sleep } from './lib/library.js';
import { MQTTClientClass, MQTTServerClass } from './lib/mqtt.js';
import { genericStateObjects, statesObjects } from './lib/definition.js';
import 'source-map-support/register';
import { trilaterate4 } from './lib/tools.js';

// Load your modules here, e.g.:
// import * as fs from "fs";

export class Espresense extends utils.Adapter {
    library: Library;
    unload: boolean = false;
    mqttClient: MQTTClientClass | undefined;
    mqttServer: MQTTServerClass | undefined;
    namedDevices: { [key: string]: string } = {};
    timeout: ioBroker.Timeout | undefined = undefined;
    startDelay: ioBroker.Timeout | undefined = undefined;
    unseenCheckTime: number = 5000;
    deviceDB: { [id: string]: { name: string; lc: number } } = {};
    delayedMessages: { [key: string]: any } = {};
    roomDB: { [key: string]: [number, number, number] | undefined } = {};
    calculateDelayTimeout: { [key: string]: ioBroker.Timeout | undefined } = {};

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'espresense',
        });
        this.library = new Library(this);
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Reset the connection indicator during startup
        await this.setState('info.connection', false, true);
        await this.library.init();
        this.log.info(`Starting ${this.name} adapter v${this.version}`);
        await this.library.initStates(await this.getStatesAsync('*'));
        this.library.defaults.updateStateOnChangeOnly = false;

        await this.library.writedp('devices', undefined, genericStateObjects.devices);
        await this.library.writedp('rooms', undefined, genericStateObjects.rooms);
        await this.library.writedp('settings', undefined, genericStateObjects.settings);
        await this.library.writedp('global', undefined, genericStateObjects.global);
        for (const id in statesObjects.rooms) {
            //@ts-expect-error id is keyof
            const obj = statesObjects.rooms[id];
            if (obj && obj.common && obj.common.write === true && id !== 'max_distance_ioBroker') {
                const val = this.library.readdb(`global.${id}`);
                if (val == undefined) {
                    const val: any =
                        obj.common.type == 'string'
                            ? ''
                            : obj.common.type == 'number'
                              ? -1
                              : obj.common.type == 'boolean'
                                ? false
                                : null;
                    await this.library.writedp(`global.${id}`, val, obj, false);
                }
            }
        }
        const temp = this.library.readdb('deviceDB');
        if (temp && temp.val && typeof temp.val == 'string') {
            this.deviceDB = JSON.parse(temp.val);
        }
        await this.subscribeStatesAsync('devices.*');
        await this.subscribeStatesAsync('rooms.*');
        await this.subscribeStatesAsync('global.*');
        this.namedDevices = {};
        //check config
        let testIt: any = this.config.MQTTServerIp;
        if ((testIt == '' || typeof testIt != 'string') && !this.config.MQTTUseServer) {
            this.log.error(`Invalid configuration mqtt server ip has unexpeted value: ${testIt}`);
            return;
        }
        testIt = this.config.MQTTServerPort;
        if (typeof testIt != 'number' || testIt <= 1023) {
            this.log.error(`Invalid configuration mqtt server port has unexpeted value: ${testIt}`);
            return;
        }
        testIt = this.config.MQTTPassword;
        if (typeof testIt != 'string') {
            this.log.error(`Invalid configuration mqtt server password has unexpeted value type ${typeof testIt}`);
            return;
        }
        testIt = this.config.MQTTHandleInterval;
        if (typeof testIt != 'number') {
            this.log.error(`Invalid configuration mqtt handle interval has unexpeted value type ${typeof testIt}`);
            return;
        }

        this.config.MQTTHandleInterval *= 1000;
        if (this.config.MQTTHandleInterval > 2 ** 32 / 2 - 1) {
            this.config.MQTTHandleInterval = 2 ** 32 / 2 - 1;
        }

        testIt = this.config.MQTTUsername;
        if (typeof testIt != 'string') {
            this.log.error(`Invalid configuration mqtt username has unexpeted value typ: ${typeof testIt}`);
            return;
        }
        testIt = this.config.unseenTime;
        if (isNaN(testIt) || testIt == '' || testIt < 5) {
            this.config.unseenTime = 20;
        }
        testIt = this.config.selectedDevices;
        if (typeof testIt != 'object' || !Array.isArray(testIt)) {
            this.config.selectedDevices = [];
        } else {
            const oldConfig = JSON.stringify(this.config.selectedDevices);
            this.config.selectedDevices = this.config.selectedDevices.filter(a => {
                return typeof a.id == 'string' && a.id != '';
            });
            if (oldConfig != JSON.stringify(this.config.selectedDevices)) {
                const obj = await this.getForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`);
                if (obj && obj.native) {
                    obj.native.selectedDevices = this.config.selectedDevices;
                    await this.setForeignObjectAsync(`system.adapter.${this.name}.${this.instance}`, obj);
                    this.log.warn('Fixed configuration for selected devices! ');
                }
            }
        }
        this.config.unseenTime *= 1000;
        // configuration ok
        // refresh states
        if ((this.config.selectedDevices || []).length > 0) {
            await this.library.cleanUpTree(
                this.config.selectedDevices.map(a => `devices.${this.library.cleandp(a.id, false, true)}`),
                [`devices.`],
                -1,
            );
        }
        await this.library.initStates(await this.getStatesAsync('*'));

        const rooms = this.library.getStates('rooms.*.positionsArray');
        for (const id in rooms) {
            const data = rooms[id];
            if (data && data.val && typeof data.val == 'string') {
                try {
                    this.roomDB[id.split('.')[1]] = JSON.parse(data.val);
                } catch (e: any) {
                    this.log.error(e);
                    this.log.error(`Not a array in Room: ${id} data: ${data.val}`);
                }
            }
        }
        this.log.debug(`Rooms: ${JSON.stringify(rooms)}`);

        if (this.config.MQTTUseServer) {
            this.mqttServer = new MQTTServerClass(
                this,
                this.config.MQTTServerPort,
                this.config.MQTTUsername,
                this.config.MQTTPassword,
                utils.getAbsoluteInstanceDataDir(this),
            );
        }
        await this.delay(200);
        this.mqttClient = new MQTTClientClass(
            this,
            this.config.MQTTUseServer ? '127.0.0.1' : this.config.MQTTServerIp,
            this.config.MQTTServerPort,
            this.config.MQTTUsername,
            this.config.MQTTPassword,
        );

        if (!this.config.retainGlobal) {
            for (const id in statesObjects.rooms) {
                const topic = `espresense/rooms/*/${id}/set`;
                if (this.mqttClient) {
                    await this.mqttClient.publish(topic, '', { retain: true });
                }
            }
        }
        this.doDelayedMessage();
    }

    private doDelayedMessage(): void {
        this.timeout = this.setTimeout(async () => {
            if (this.unload) {
                return;
            }

            for (const dp in this.delayedMessages) {
                const cmd = this.delayedMessages[dp];
                if (cmd !== undefined) {
                    this.delayedMessages[dp] = undefined;
                    await this.handleMessage(dp, cmd, false);
                }
            }
            this.delayedMessages = Object.fromEntries(
                Object.entries(this.delayedMessages).filter(([_, v]) => v != undefined),
            );
            await sleep(100);
            await this.library.garbageColleting('devices.', this.config.unseenTime);
            this.doDelayedMessage();
        }, this.config.MQTTHandleInterval);
    }
    async handleMessage(topic: string, message: any, delayed: boolean = true): Promise<void> {
        if (!topic || message == undefined) {
            return;
        }
        if (delayed && this.config.MQTTHandleInterval > 0) {
            this.delayedMessages[topic] = message;
            return;
        }
        this.log.debug(
            `${topic}: ${typeof message} - ${typeof message == 'object' ? JSON.stringify(message) : message}`,
        );

        const parts = topic.split('/');
        parts.shift();
        if (parts[0] !== 'rooms' && parts[0] !== 'settings' && parts[0] !== 'devices') {
            return;
        }
        const typ: 'settings' | 'devices' | 'rooms' = parts[0];
        parts.shift();
        const temp = this.library.cloneGenericObject(statesObjects[typ]._channel) as ioBroker.DeviceObject;

        let device = parts.shift();
        device = device ? device : 'no_name';
        if (message && message.name && message.id) {
            this.namedDevices[message.id] = message.name;
        }

        temp.common.name = this.namedDevices[device] || device;

        if (typ === 'settings' && message.name) {
            temp.common.name = message.name;
        }
        if (typ === 'devices') {
            const index = (this.config.selectedDevices || []).findIndex(i => i.id === device);

            this.namedDevices[message.id] =
                index != -1 ? this.config.selectedDevices[index].name : this.namedDevices[message.id];
            temp.common.name = this.namedDevices[message.id];
            this.deviceDB[device] = { name: this.namedDevices[device] || device, lc: Date.now() };
            this.library
                .writedp('deviceDB', JSON.stringify(this.deviceDB), genericStateObjects.deviceDB)
                .catch(() => {});
            if (this.config.selectedDevices.length > 0) {
                if (index == -1) {
                    return;
                }
            }
        }
        device = this.library.cleandp(device, false, true);
        if (typ !== 'rooms' && device != '*') {
            await this.library.writedp(`${typ}.${device}`, undefined, {
                ...temp,
                type: 'device',
                common: {
                    ...temp.common,
                    statusStates: {
                        onlineId: 'presense',
                    },
                },
            });
        }

        switch (typ) {
            case 'rooms':
                {
                    // ignore set commands
                    let path = `${typ}.${device}`;
                    if (device == '*') {
                        path = 'global';
                        if (parts[parts.length - 1] == 'set') {
                            parts.pop();
                        }
                    } else if (parts[parts.length - 1] == 'set') {
                        return;
                    } else {
                        await this.library.writedp(
                            `${typ}.${device}.max_distance_ioBroker`,
                            undefined,
                            statesObjects.rooms.max_distance_ioBroker,
                        );
                        await this.library.writedp(
                            `${typ}.${device}.positionsArray`,
                            undefined,
                            statesObjects.rooms.positionsArray,
                        );
                        await this.library.writedp(`${typ}.${device}`, undefined, temp);
                    }

                    const data: any = {};
                    const t = parts.join('.');
                    data[t] = message;
                    try {
                        data.restart = false;
                        await this.library.writeFromJson(path, typ, statesObjects, data);
                    } catch (e: any) {
                        this.log.error(e);
                        this.log.error(`Topic:${topic} data: ${JSON.stringify(data)}`);
                    }
                }
                break;

            case 'settings':
                {
                    const data: any = {};
                    this.namedDevices[message.id] = message.name;

                    data[parts.join('.')] = message;
                    await this.library.writeFromJson(`${typ}.${device}`, typ, statesObjects, data);
                    await this.library.writedp(
                        `${typ}.${device}.max_distance_ioBroker`,
                        undefined,
                        statesObjects.rooms.max_distance_ioBroker,
                    );
                }
                break;

            case 'devices': {
                if (this.calculateDelayTimeout[device] !== undefined) {
                    this.clearTimeout(this.calculateDelayTimeout[device]);
                }

                let subDevice = parts.shift();
                subDevice = subDevice ? subDevice : 'no_name';
                subDevice = this.library.cleandp(subDevice, false, true);
                const temp = this.library.cloneGenericObject(statesObjects[typ]._channel) as ioBroker.DeviceObject;
                temp.common.name = this.namedDevices[`node:${subDevice}`] || subDevice;
                message.friendlyRoomName = this.namedDevices[`node:${subDevice}`] || 'Error: Report to developer';
                const tempObj: LibraryStateVal = this.library.readdb(`${typ}.${device}.${subDevice}.convertFactor`);
                const max_distance_ioBroker: LibraryStateVal = this.library.readdb(
                    `rooms.${subDevice}.max_distance_ioBroker`,
                );
                message.convertFactor = 100;
                message.convert = 0;
                if (tempObj !== undefined && tempObj !== null) {
                    message.convertFactor = tempObj.val;
                }
                message.distanceConverted = (message.distance * message.convertFactor) / 100;

                // if max_distance_ioBroker is set, use it to determine presence otherwise use default.
                if (
                    max_distance_ioBroker !== undefined &&
                    max_distance_ioBroker !== null &&
                    max_distance_ioBroker.val !== undefined &&
                    max_distance_ioBroker.val !== null &&
                    max_distance_ioBroker.val !== -1
                ) {
                    await this.library.writedp(
                        `${typ}.${device}.${subDevice}.presense`,
                        max_distance_ioBroker.val >= message.distanceConverted,
                        genericStateObjects.presense,
                    );
                    if (max_distance_ioBroker.val >= message.distanceConverted) {
                        await this.library.writedp(`${typ}.${device}.presense`, true, genericStateObjects.presense);
                    }
                } else {
                    await this.library.writedp(
                        `${typ}.${device}.${subDevice}.presense`,
                        true,
                        genericStateObjects.presense,
                    );
                    await this.library.writedp(`${typ}.${device}.presense`, true, genericStateObjects.presense);
                }
                await this.library.writedp(`${typ}.${device}.${subDevice}`, undefined, {
                    ...temp,
                    common: {
                        ...temp.common,
                        statusStates: {
                            onlineId: 'presense',
                        },
                    },
                });
                await this.library.writeFromJson(`${typ}.${device}.${subDevice}`, typ, statesObjects, message);
                this.calculateDelayTimeout[device] = this.setTimeout(
                    async _device => {
                        const roomsToUse = Object.keys(this.roomDB)
                            .filter(a => {
                                const data = this.roomDB[a];
                                if (data && typeof data === 'object' && Array.isArray(data)) {
                                    return true;
                                }
                                return false;
                            })
                            .map(a => {
                                return {
                                    name: a,
                                    pos: this.roomDB[a]!,
                                    distance: (this.library.readdb(`devices.${_device}.${a}.distanceConverted`) || {})
                                        .val,
                                    presense: !!(this.library.readdb(`devices.${_device}.${a}.presense`) || {}).val,
                                };
                            })
                            .filter(a => a.presense && typeof a.distance === 'number' && a.pos && Array.isArray(a.pos));
                        if (roomsToUse.length < 4) {
                            return;
                        }

                        roomsToUse.sort((a, b) => {
                            if (a.distance! < b.distance!) {
                                return -1;
                            } else if (a.distance! > b.distance!) {
                                return 1;
                            }
                            return 0;
                        });
                        const rooms = roomsToUse.slice(0, 4);

                        const result = trilaterate4(
                            rooms[0].pos,
                            rooms[0].distance as number,
                            rooms[1].pos,
                            rooms[1].distance as number,
                            rooms[2].pos,
                            rooms[2].distance as number,
                            rooms[3].pos,
                            rooms[3].distance as number,
                        );
                        const position = result.position;
                        if (position) {
                            position[0] = Math.round(position[0] * 100) / 100;
                            position[1] = Math.round(position[1] * 100) / 100;
                            position[2] = Math.round(position[2] * 100) / 100;
                        }
                        this.log.debug(`Position: ${JSON.stringify(position)}`);
                        await this.library.writedp(
                            `devices.${_device}.position`,
                            JSON.stringify(position),
                            genericStateObjects.position,
                        );
                        await this.library.writedp(
                            `devices.${_device}.positionQuality`,
                            result.zSquared,
                            genericStateObjects.positionQuality,
                        );
                    },
                    150,
                    device,
                );
            }
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     *
     * @param callback
     */
    private onUnload(callback: () => void): void {
        try {
            this.unload = true;
            if (this.mqttClient) {
                this.mqttClient.destroy();
            }
            if (this.mqttServer) {
                this.mqttServer.destroy();
            }
            if (this.timeout) {
                this.clearTimeout(this.timeout);
            }
            if (this.startDelay) {
                this.clearTimeout(this.startDelay);
            }
            this.library.delete();
            callback();
        } catch {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  */
    // private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     *
     * @param id
     * @param state
     */
    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (state && !state.ack) {
            id = id.replace(`${this.namespace}.`, '');
            const dbEntry = this.library.readdb(id);
            if (dbEntry && dbEntry.obj && dbEntry.obj.common && dbEntry.obj.common.write) {
                const native = dbEntry.obj.native;
                let val = state.val;
                if (native && native.convert) {
                    const fn = new Function('val', `return ${native.convert}`);
                    val = fn(val);
                }
                if (id.endsWith('.convert') && id.startsWith('devices.')) {
                    const dist = this.library.readdb(`${id.substring(0, id.lastIndexOf('.'))}.distance`);
                    if (
                        dist &&
                        val !== undefined &&
                        val !== null &&
                        dist.val !== undefined &&
                        dist.val !== null &&
                        !isNaN(val as number) &&
                        !isNaN(dist.val as number)
                    ) {
                        val = (val as number) / (dist.val as number); // (convO.val as number);
                        await this.library.writedp(id, 0, statesObjects.devices.convert, true);
                        await this.library.writedp(
                            `${id.substring(0, id.lastIndexOf('.'))}.convertFactor`,
                            val * 100,
                            statesObjects.devices.convertFactor,
                            true,
                        );
                        await this.library.writedp(
                            `${id.substring(0, id.lastIndexOf('.'))}.distanceConverted`,
                            val * (dist.val as number),
                            statesObjects.devices.distanceConverted,
                            true,
                        );
                    }
                } else if (id.endsWith('.distanceIoBroker') && id.startsWith('rooms.')) {
                    await this.library.writedp(id, state.val, statesObjects.rooms.max_distance_ioBroker, true);
                } else if (id.endsWith('.positionsArray') && id.startsWith('rooms.')) {
                    const data = state.val;
                    if (typeof data == 'string') {
                        try {
                            this.roomDB[id.split('.')[1]] = JSON.parse(data);
                            await this.library.writedp(id, state.val, undefined, true);
                        } catch (e: any) {
                            this.log.error(e);
                            this.log.error(`Not a array in Room: ${id} data: ${data}`);
                        }
                    }
                } else {
                    this.library.setdb(id, 'state', state.val, undefined, state.ack, state.ts);
                    const global = id.split('.')[0] === 'global';
                    const topic = global
                        ? `espresense/rooms/*/${id.split('.')[1]}/set`
                        : `espresense/${id.split('.').join('/')}/set`;
                    if (this.mqttClient) {
                        await this.mqttClient.publish(topic, String(val), {
                            retain: id.endsWith('.restart') ? false : !!this.config.retainGlobal,
                        });
                        await this.library.writedp(id, state.val, undefined, true);
                    }
                }
            } else {
                this.library.setdb(id, 'state', state.val, undefined, state.ack, state.ts);
            }
        }
    }

    //If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    /**
     * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
     * Using this method requires "common.messagebox" property to be set to true in io-package.json
     *
     * @param obj
     */
    private onMessage(obj: ioBroker.Message): void {
        if (typeof obj === 'object' && obj.message) {
            this.log.debug(`Message: ${JSON.stringify(obj)}`);
            switch (obj.command) {
                case 'getDevices':
                    {
                        let result: { label: string; value: string }[] = [];
                        for (const device of this.config.selectedDevices) {
                            result.push({
                                label: device.name,
                                value: device.id,
                            });
                        }
                        for (const id in this.deviceDB) {
                            const data = this.deviceDB[id];
                            if (data.lc < Date.now() - 300000) {
                                delete this.deviceDB[id];
                                continue;
                            } else {
                                if (id == '') {
                                    continue;
                                }
                                if (data.name == '') {
                                    data.name = id;
                                }
                                result.push({ label: data.name, value: id });
                            }
                        }
                        result = result.filter(
                            (a, b) =>
                                result.findIndex(c => {
                                    return c.value == a.value;
                                }) == b,
                        );
                        this.library
                            .writedp('deviceDB', JSON.stringify(this.deviceDB), genericStateObjects.deviceDB)
                            .catch(() => {});
                        if (obj.callback) {
                            this.log.debug(result ? JSON.stringify(result) : 'invalid result');
                            this.sendTo(obj.from, obj.command, result ?? [], obj.callback);
                        }
                    }
                    break;
                case 'addDevice':
                    {
                        if (
                            this.config.selectedDevices.findIndex(i => {
                                return i.id == obj.message.id;
                            }) == -1
                        ) {
                            this.config.selectedDevices.push({
                                id: obj.message.id,
                                name:
                                    (this.deviceDB[obj.message.id] && this.deviceDB[obj.message.id].name) ||
                                    obj.message.id,
                            });
                        }
                        if (obj.callback) {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { native: { selectedDevices: this.config.selectedDevices } },
                                obj.callback,
                            );
                        }
                    }
                    break;
                case 'removeDevice':
                    {
                        if (this.config.selectedDevices.findIndex(i => i.id == obj.message.id) != -1) {
                            this.config.selectedDevices.splice(
                                this.config.selectedDevices.findIndex(i => i.id == obj.message.id),
                                1,
                            );
                        }
                        if (obj.callback) {
                            this.sendTo(
                                obj.from,
                                obj.command,
                                { native: { selectedDevices: this.config.selectedDevices } },
                                obj.callback,
                            );
                        }
                    }
                    break;
            }
            if (obj.command === 'send') {
                // e.g. send email or pushover or whatever
                this.log.info('send command');

                // Send response in callback if required
                if (obj.callback) {
                    this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
                }
            }
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Espresense(options);
} else {
    // otherwise start the instance directly
    (() => new Espresense())();
}

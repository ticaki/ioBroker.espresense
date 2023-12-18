import mqtt from 'mqtt'; // import namespace "mqtt"
import { AdapterClassDefinition, BaseClass } from './library';

type mqttCallbackType = (a: string, b: object) => void;

import Aedes from 'aedes';
import { Server, createServer } from 'net';
import { Espresense } from '../main';

export class MQTTClientClass extends BaseClass {
    callback: mqttCallbackType;
    client: mqtt.MqttClient;
    data: any = {};
    constructor(
        adapter: AdapterClassDefinition,
        ip: string,
        port: number,
        username: string,
        password: string,
        callback: mqttCallbackType,
    ) {
        super(adapter, 'mqttClient');
        this.callback = callback;
        this.client = mqtt.connect(`mqtt://${ip}:${port}`, { username: username, password: password });
        this.client.on('connect', () => {
            this.log.info(`connection is active.`);
            this.adapter.setState('info.connection', true, true);
            this.client.subscribe('espresense/#', (err) => {
                if (err) {
                    this.log.error(`On subscribe: ${err}`);
                }
            });
        });
        this.client.on('disconnect', () => {
            this.adapter.setState('info.connection', false, true);
            this.log.debug(`disconnected`);
        });
        this.client.on('error', (err) => {
            this.log.error(`${err}`);
        });

        this.client.on('close', () => {
            this.adapter.setState('info.connection', false, true);
            this.log.info(`connection is closed.`);
        });

        this.client.on('message', (topic, message) => {
            //this.log.debug('topic: ' + topic + ' message: ' + message.toString() + ' type:');
            let value: any;
            let type: string = '';
            try {
                value = JSON.parse(message.toString());
                if (typeof value == 'string') throw new Error('nope');
                type = typeof value;
            } catch (e: any) {
                value = message.toString();
                if (isNaN(value)) {
                    if (value == 'ON' || value == 'OFF') {
                        type = 'boolean';
                        value = value == 'ON';
                    } else {
                        type = 'string';
                    }
                } else if (value == '') {
                    type = 'string';
                } else {
                    type = 'number1';
                    this.log.debug(typeof value);
                    value = parseFloat(value);
                }
            }
            const test = topic.split('/');
            const key = test.pop();
            if (this.data[test.join('_')] === undefined) this.data[test.join('_')] = {};
            if (key !== undefined) this.data[test.join('_')][key] = value;

            this.log.debug(`${topic}: ${type} - ${value}`);
            //this.log.debug(`json: ${JSON.stringify(this.data)}`);
            this.callback(topic, value);
        });
    }

    destroy(): void {
        this.client.end();
    }
}

export class MQTTServerClass extends BaseClass {
    aedes: Aedes;
    server: Server;
    constructor(adapter: Espresense, port: number, username: string, password: string) {
        super(adapter, 'mqttServer');
        this.aedes = new Aedes();
        this.server = createServer(this.aedes.handle);

        this.server.listen(port, function () {
            console.log('server started and listening on port ', port);
        });
        this.aedes.authenticate = (
            cleint: any,
            un: Readonly<string | undefined>,
            pw: Readonly<Buffer | undefined>,
            callback: any,
        ) => {
            callback(null, username === un && password == (pw as unknown as string));
        };
    }
}

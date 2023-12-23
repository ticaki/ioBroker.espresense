"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var main_exports = {};
__export(main_exports, {
  Espresense: () => Espresense
});
module.exports = __toCommonJS(main_exports);
var utils = __toESM(require("@iobroker/adapter-core"));
var import_library = require("./lib/library.js");
var import_mqtt = require("./lib/mqtt.js");
var import_definition = require("./lib/definition.js");
var import_register = require("source-map-support/register");
class Espresense extends utils.Adapter {
  library;
  mqttClient;
  mqttServer;
  namedDevices = {};
  timeout = void 0;
  startDelay = void 0;
  unseenCheckTime = 5e3;
  deviceDB = {};
  constructor(options = {}) {
    super({
      ...options,
      name: "espresense"
    });
    this.library = new import_library.Library(this);
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("message", this.onMessage.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    this.setStateAsync("info.connection", false, true);
    this.startDelay = this.setTimeout(async () => {
      await this.library.init();
      await this.library.initStates(await this.getStatesAsync("*"));
      this.library.defaults.updateStateOnChangeOnly = false;
      this.library.writedp("devices", void 0, import_definition.genericStateObjects.devices);
      this.library.writedp("rooms", void 0, import_definition.genericStateObjects.rooms);
      this.library.writedp("settings", void 0, import_definition.genericStateObjects.settings);
      const temp = this.library.readdp("deviceDB");
      if (temp && temp.val && typeof temp.val == "string") {
        this.deviceDB = JSON.parse(temp.val);
      }
      await this.subscribeStatesAsync("rooms.*");
      this.namedDevices = {};
      let testIt = this.config.MQTTServerIp;
      if ((testIt == "" || typeof testIt != "string") && !this.config.MQTTUseServer) {
        this.log.error(`Invalid configuration mqtt server ip has unexpeted value: ${testIt}`);
        return;
      }
      testIt = this.config.MQTTServerPort;
      if (typeof testIt != "number" || testIt <= 1023) {
        this.log.error(`Invalid configuration mqtt server port has unexpeted value: ${testIt}`);
        return;
      }
      testIt = this.config.MQTTPassword;
      if (typeof testIt != "string") {
        this.log.error(`Invalid configuration mqtt server password has unexpeted value type ${typeof testIt}`);
        return;
      }
      testIt = this.config.MQTTUsername;
      if (typeof testIt != "string") {
        this.log.error(`Invalid configuration mqtt username has unexpeted value typ: ${typeof testIt}`);
        return;
      }
      testIt = this.config.unseenTime;
      if (isNaN(testIt) || testIt == "" || testIt < 5) {
        this.config.unseenTime = 20;
      }
      testIt = this.config.selectedDevices;
      if (typeof testIt != "object" || !Array.isArray(testIt)) {
        this.config.selectedDevices = [];
      }
      this.config.unseenTime *= 1e3;
      if ((this.config.selectedDevices || []).length > 0) {
        await this.library.cleanUpTree(
          this.config.selectedDevices.map((a) => `devices.${this.library.cleandp(a.id, false, true)}`),
          [`devices.`],
          -1
        );
      }
      await this.library.initStates(await this.getStatesAsync("*"));
      if (this.config.MQTTUseServer) {
        this.mqttServer = new import_mqtt.MQTTServerClass(
          this,
          this.config.MQTTServerPort,
          this.config.MQTTUsername,
          this.config.MQTTPassword,
          utils.getAbsoluteInstanceDataDir(this)
        );
      }
      this.mqttClient = new import_mqtt.MQTTClientClass(
        this,
        this.config.MQTTUseServer ? "127.0.0.1" : this.config.MQTTServerIp,
        this.config.MQTTServerPort,
        this.config.MQTTUsername,
        this.config.MQTTPassword
      );
      this.timeout = this.setInterval(() => {
        this.library.garbageColleting("devices.", this.config.unseenTime);
      }, this.unseenCheckTime);
    }, 1e3);
  }
  async handleMessage(topic, message) {
    if (!topic || message == void 0)
      return;
    const topicA = topic.split("/");
    topicA.shift();
    const typTemp = topicA.shift();
    if (typTemp !== "rooms" && typTemp !== "settings" && typTemp !== "devices")
      return;
    const typ = typTemp;
    const temp = this.library.cloneGenericObject(import_definition.statesObjects[typ]._channel);
    let device = topicA.shift();
    device = device ? device : "no_name";
    if (message && message.name && message.id) {
      this.namedDevices[message.id] = message.name;
    }
    temp.common.name = this.namedDevices[device] || device;
    if (typ === "settings" && message.name)
      temp.common.name = message.name;
    if (typ === "devices") {
      this.deviceDB[device] = { name: this.namedDevices[device] || device, lc: Date.now() };
      this.library.writedp("deviceDB", JSON.stringify(this.deviceDB), import_definition.genericStateObjects.deviceDB);
      if (this.config.selectedDevices.length > 0) {
        if (this.config.selectedDevices.findIndex((i) => {
          return i.id === device;
        }) == -1)
          return;
      }
    }
    device = this.library.cleandp(device, false, true);
    await this.library.writedp(`${typ}.${device}`, void 0, temp);
    if (typ === "rooms") {
      if (topicA[topicA.length - 1] == "set")
        return;
      const data = {};
      data[topicA.join(".")] = message;
      try {
        data.restart = false;
        await this.library.writeFromJson(`${typ}.${device}`, typ, import_definition.statesObjects, data);
      } catch (e) {
        this.log.error(e);
        this.log.error(`Topic:${topic} data: ${JSON.stringify(data)}`);
      }
    } else if (typ === "settings") {
      const data = {};
      this.namedDevices[message.id] = message.name;
      data[topicA.join(".")] = message;
      await this.library.writeFromJson(`${typ}.${device}`, typ, import_definition.statesObjects, data);
    } else if (typ === "devices") {
      let subDevice = topicA.shift();
      subDevice = subDevice ? subDevice : "no_name";
      subDevice = this.library.cleandp(subDevice, false, true);
      const temp2 = this.library.cloneGenericObject(import_definition.statesObjects[typ]._channel);
      temp2.common.name = this.namedDevices[subDevice] || subDevice;
      await this.library.writedp(`${typ}.${device}.${subDevice}`, void 0, temp2);
      await this.library.writedp(`${typ}.${device}.presense`, true, import_definition.genericStateObjects.presense);
      await this.library.writeFromJson(`${typ}.${device}.${subDevice}`, typ, import_definition.statesObjects, message);
    }
  }
  onUnload(callback) {
    try {
      if (this.mqttClient)
        this.mqttClient.destroy();
      if (this.mqttServer)
        this.mqttServer.destroy();
      if (this.timeout)
        this.clearInterval(this.timeout);
      if (this.startDelay)
        this.clearTimeout(this.startDelay);
      callback();
    } catch (e) {
      callback();
    }
  }
  async onStateChange(id, state) {
    if (state && !state.ack) {
      id = id.replace(`${this.namespace}.`, "");
      this.library.setdb(id, "state", state.val, void 0, state.ack, state.ts);
      const dbEntry = this.library.readdp(id);
      if (dbEntry && dbEntry.obj && dbEntry.obj.common && dbEntry.obj.common.write) {
        const native = dbEntry.obj.native;
        let val = dbEntry.val;
        if (native && native.convert) {
          const fn = new Function("val", `return ${native.convert}`);
          val = fn(val);
        }
        const topic = `espresense/${id.split(".").join("/")}/set`;
        if (this.mqttClient) {
          await this.mqttClient.publish(topic, String(val));
        }
      }
    } else {
    }
  }
  onMessage(obj) {
    if (typeof obj === "object" && obj.message) {
      switch (obj.command) {
        case "getDevices":
          {
            let result = [];
            for (const id in this.config.selectedDevices) {
              result.push({
                label: this.config.selectedDevices[id].name,
                value: this.config.selectedDevices[id].id
              });
            }
            for (const id in this.deviceDB) {
              const data = this.deviceDB[id];
              if (data.lc < Date.now() - 3e5) {
                delete this.deviceDB[id];
                continue;
              } else {
                result.push({ label: data.name, value: id });
              }
            }
            result = result.filter(
              (a, b) => result.findIndex((c) => {
                return c.value == a.value;
              }) == b
            );
            this.library.writedp("deviceDB", JSON.stringify(this.deviceDB), import_definition.genericStateObjects.deviceDB);
            if (obj.callback)
              this.sendTo(obj.from, obj.command, result, obj.callback);
          }
          break;
        case "addDevice":
          {
            if (this.config.selectedDevices.findIndex((i) => {
              return i.id == obj.message.id;
            }) == -1) {
              this.config.selectedDevices.push({
                id: obj.message.id,
                name: this.deviceDB[obj.message.id] && this.deviceDB[obj.message.id].name || obj.message.id
              });
            }
            if (obj.callback)
              this.sendTo(
                obj.from,
                obj.command,
                { native: { selectedDevices: this.config.selectedDevices } },
                obj.callback
              );
          }
          break;
        case "removeDevice":
          {
            if (this.config.selectedDevices.findIndex((i) => {
              i.id == obj.message.id;
            }) != -1) {
              this.config.selectedDevices.splice(
                this.config.selectedDevices.findIndex((i) => {
                  i.id == obj.message.id;
                }),
                1
              );
            }
            if (obj.callback)
              this.sendTo(
                obj.from,
                obj.command,
                { native: { selectedDevices: this.config.selectedDevices } },
                obj.callback
              );
          }
          break;
      }
      if (obj.command === "send") {
        this.log.info("send command");
        if (obj.callback)
          this.sendTo(obj.from, obj.command, "Message received", obj.callback);
      }
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Espresense(options);
} else {
  (() => new Espresense())();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Espresense
});
//# sourceMappingURL=main.js.map

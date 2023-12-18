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
  constructor(options = {}) {
    super({
      ...options,
      name: "espresense"
    });
    this.library = new import_library.Library(this);
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    this.setStateAsync("info.connection", false, true);
    await this.library.init();
    await this.library.initStates(await this.getStatesAsync("*"));
    this.library.writedp("devices", void 0, import_definition.genericStateObjects.devices);
    this.library.writedp("rooms", void 0, import_definition.genericStateObjects.rooms);
    this.library.writedp("settings", void 0, import_definition.genericStateObjects.configs);
    let testIt = this.config.MQTTServerIp;
    if (testIt == "" || typeof testIt != "string") {
      this.log.warn(`Invalid configuration mqtt server ip has unexpeted value: ${testIt}`);
      this.stop();
      return;
    }
    testIt = this.config.MQTTServerPort;
    if (typeof testIt != "number" || testIt <= 1023) {
      this.log.warn(`Invalid configuration mqtt server port has unexpeted value: ${testIt}`);
      this.stop();
      return;
    }
    testIt = this.config.MQTTPassword;
    if (typeof testIt != "string") {
      this.log.error(`Invalid configuration mqtt server password has unexpeted value type ${typeof testIt}`);
      this.stop();
      return;
    }
    testIt = this.config.MQTTUsername;
    if (typeof testIt != "string") {
      this.log.error(`Invalid configuration mqtt username has unexpeted value typ: ${typeof testIt}`);
      this.stop();
      return;
    }
    if (this.config.MQTTUseServer) {
      this.mqttServer = new import_mqtt.MQTTServerClass(
        this,
        this.config.MQTTServerPort,
        this.config.MQTTUsername,
        this.config.MQTTPassword
      );
    }
    this.mqttClient = new import_mqtt.MQTTClientClass(
      this,
      this.config.MQTTUseServer ? "127.0.0.1" : this.config.MQTTServerIp,
      this.config.MQTTServerPort,
      this.config.MQTTUsername,
      this.config.MQTTPassword,
      this.handleMessage
    );
  }
  async handleMessage(topic, message) {
    if (!topic || message == void 0)
      return;
    const topicA = topic.split("/");
    topicA.shift();
    const typ = topicA.shift();
    if (typ !== "rooms" && typ !== "settings" && typ !== "devices")
      return;
    const temp = this.library.cloneGenericObject(import_definition.statesObjects[typ]._channel);
    let name = topicA.shift();
    name = name ? name : "no_name";
    temp.common.name = name;
    await this.library.writedp(`${typ}.${name}`, void 0, temp);
    if (typ === "rooms") {
      const data = {};
      data[topicA.join(".")] = message;
      await this.library.writeFromJson(`${typ}.${name}`, typ, import_definition.statesObjects, data);
    } else if (typ === "settings") {
      const data = {};
      data[topicA.join(".")] = message;
      await this.library.writeFromJson(`${typ}.${name}`, typ, import_definition.statesObjects, data);
      if (typ === "settings")
        this.log.debug(JSON.stringify(data));
    } else if (typ === "devices") {
      let subName = topicA.shift();
      subName = subName ? subName : "no_name";
      const temp2 = this.library.cloneGenericObject(import_definition.statesObjects[typ]._channel);
      temp2.common.name = subName;
      await this.library.writedp(`${typ}.${name}.${subName}`, void 0, temp2);
      await this.library.writeFromJson(`${typ}.${name}.${subName}`, typ, import_definition.statesObjects, message);
    }
  }
  onUnload(callback) {
    try {
      if (this.mqttClient)
        this.mqttClient.destroy();
      if (this.mqttServer)
        this.mqttServer.destroy();
      callback();
    } catch (e) {
      callback();
    }
  }
  onStateChange(id, state) {
    if (state) {
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      this.log.info(`state ${id} deleted`);
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

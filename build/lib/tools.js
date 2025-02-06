"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var tools_exports = {};
__export(tools_exports, {
  trilaterate4: () => trilaterate4
});
module.exports = __toCommonJS(tools_exports);
function trilaterate4(p12, d12, p22, d22, p32, d32, p42, d42) {
  const ex = normalize(subtract(p22, p12));
  const i = dot(ex, subtract(p32, p12));
  const ey = normalize(subtract(subtract(p32, p12), scale(ex, i)));
  const ez = cross(ex, ey);
  const d = distance(p12, p22);
  const j = dot(ey, subtract(p32, p12));
  const x = (d12 ** 2 - d22 ** 2 + d ** 2) / (2 * d);
  const y = (d12 ** 2 - d32 ** 2 + i ** 2 + j ** 2) / (2 * j) - i / j * x;
  const zSquared = d12 ** 2 - x ** 2 - y ** 2;
  if (zSquared < -16) {
    return { position: null, zSquared };
  }
  const z = Math.sqrt(Math.max(zSquared, 0));
  const pA = add(p12, add(scale(ex, x), add(scale(ey, y), scale(ez, z))));
  const pB = add(p12, add(scale(ex, x), add(scale(ey, y), scale(ez, -z))));
  return { position: chooseCorrectPoint(pA, pB, p42, d42), zSquared };
}
function chooseCorrectPoint(pA, pB, p42, d42) {
  const dA = distance(pA, p42);
  const dB = distance(pB, p42);
  return Math.abs(dA - d42) < Math.abs(dB - d42) ? pA : pB;
}
function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function distance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
function normalize(v) {
  const mag = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / mag, v[1] / mag, v[2] / mag];
}
const p1 = [0, 0, 0], d1 = 5;
const p2 = [10, 0, 0], d2 = 5;
const p3 = [5, 5, 0], d3 = 5;
const p4 = [5, 2, 5], d4 = 5;
console.log(trilaterate4(p1, d1, p2, d2, p3, d3, p4, d4));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  trilaterate4
});
//# sourceMappingURL=tools.js.map

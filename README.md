![Logo](admin/espresense.png)
# ioBroker.espresense

[![NPM version](https://img.shields.io/npm/v/iobroker.espresense.svg)](https://www.npmjs.com/package/iobroker.espresense)
[![Downloads](https://img.shields.io/npm/dm/iobroker.espresense.svg)](https://www.npmjs.com/package/iobroker.espresense)
![Number of Installations](https://iobroker.live/badges/espresense-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/espresense-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.espresense.png?downloads=true)](https://nodei.co/npm/iobroker.espresense/)

**Tests:** ![Test and Release](https://github.com/ticaki/ioBroker.espresense/workflows/Test%20and%20Release/badge.svg)

## espresense adapter for ioBroker

Connect to ESPresense

Was geht:
- Daten werden in States geschrieben.
- Server und Clientmodus für MQTT
- Es gibt je Gerät einen Anwesenheitsdatenpunkt - incl. Adminkonfiguration ab welcher Abwesenheitszeit dieser auf false gehen soll. Aktualisierung im espresense muß natürlich kleiner sein als diese Zeit.
- Datenpunkte unterhalb von devices. werden nach 30 Tagen inaktivität entfernt
- Datenpunkte werden immer aktualisiert wenn Daten rein kommen.
- Datenpunkte unter rooms die beschreibbar sind, werden an den ESP gesendet zur Konfiguration
- Filtern muß aktuell vom ESP übernommen werden.

Noch zu tun:
- Filter über den Admin konfigurierbar machen, die 30 Tage entfernen und alle Geräte, die nicht ausgewählt sind, ignorieren. 
- Name der States hinzufügen (rooms.folder z.B. ist nur ein Token)

Noch zu tun

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (ticaki) Added: send configuration datapoints to esp

### 0.0.3 (2023-12-19)
* (ticaki) Added: Mqtt Server with file db

### 0.0.2 (2023-12-18)
* (ticaki) initial release

## License
MIT License

Copyright (c) 2023 ticaki <github@renopoint.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
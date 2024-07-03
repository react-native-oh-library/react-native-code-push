"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = __importDefault(require("child_process"));
var moment_1 = __importDefault(require("moment"));
var path_1 = __importDefault(require("path"));
var which_1 = __importDefault(require("which"));
var simctl = require('simctl');
var AndroidDebugPlatform = /** @class */ (function () {
    function AndroidDebugPlatform() {
    }
    AndroidDebugPlatform.prototype.getLogProcess = function () {
        try {
            which_1.default.sync('adb');
        }
        catch (e) {
            throw new Error('ADB command not found. Please ensure it is installed and available on your path.');
        }
        var numberOfAvailableDevices = this.getNumberOfAvailableDevices();
        if (numberOfAvailableDevices === 0) {
            throw new Error('No Android devices found. Re-run this command after starting one.');
        }
        // For now there is no ability to specify device for debug like:
        // code-push debug android "192.168.121.102:5555"
        // So we have to throw an error in case more than 1 android device was attached
        // otherwise we will very likely run into an exception while trying to read ‘adb logcat’ from device which codepushified app is not running on.
        if (numberOfAvailableDevices > 1) {
            throw new Error("Found \"".concat(numberOfAvailableDevices, "\" android devices. Please leave only one device you need to debug."));
        }
        return child_process_1.default.spawn('adb', ['logcat']);
    };
    // The following is an example of what the output looks
    // like when running the "adb devices" command.
    //
    // List of devices attached
    // emulator-5554    device
    // 192.168.121.102:5555    device
    AndroidDebugPlatform.prototype.getNumberOfAvailableDevices = function () {
        var output = child_process_1.default.execSync('adb devices').toString();
        var matches = output.match(/\b(device)\b/gim);
        if (matches != null) {
            return matches.length;
        }
        return 0;
    };
    AndroidDebugPlatform.prototype.normalizeLogMessage = function (message) {
        // Check to see whether the message includes the source URL
        // suffix, and if so, strip it. This can occur in Android Cordova apps.
        var sourceURLIndex = message.indexOf('", source: file:///');
        if (~sourceURLIndex) {
            return message.substring(0, sourceURLIndex);
        }
        else {
            return message;
        }
    };
    return AndroidDebugPlatform;
}());
var iOSDebugPlatform = /** @class */ (function () {
    function iOSDebugPlatform() {
    }
    iOSDebugPlatform.prototype.getSimulatorID = function () {
        var output = simctl.list({ devices: true, silent: true });
        var simulators = output.json.devices
            .map(function (platform) { return platform.devices; })
            .reduce(function (prev, next) { return prev.concat(next); })
            .filter(function (device) { return device.state === 'Booted'; })
            .map(function (device) { return device.id; });
        return simulators[0];
    };
    iOSDebugPlatform.prototype.getLogProcess = function () {
        if (process.platform !== 'darwin') {
            throw new Error('iOS debug logs can only be viewed on OS X.');
        }
        var simulatorID = this.getSimulatorID();
        if (!simulatorID) {
            throw new Error('No iOS simulators found. Re-run this command after starting one.');
        }
        var logFilePath = path_1.default.join(process.env.HOME, 'Library/Logs/CoreSimulator', simulatorID, 'system.log');
        return child_process_1.default.spawn('tail', ['-f', logFilePath]);
    };
    iOSDebugPlatform.prototype.normalizeLogMessage = function (message) {
        return message;
    };
    return iOSDebugPlatform;
}());
var HarmonyPlatform = /** @class */ (function () {
    function HarmonyPlatform() {
    }
    HarmonyPlatform.prototype.getSimulatorID = function () {
        var output = simctl.list({ devices: true, silent: true });
        var simulators = output.json.devices
            .map(function (platform) { return platform.devices; })
            .reduce(function (prev, next) { return prev.concat(next); })
            .filter(function (device) { return device.state === 'Booted'; })
            .map(function (device) { return device.id; });
        return simulators[0];
    };
    HarmonyPlatform.prototype.getLogProcess = function () {
        if (process.platform !== 'darwin') {
            throw new Error('harmony debug logs can only be viewed on OS X.');
        }
        var simulatorID = this.getSimulatorID();
        if (!simulatorID) {
            throw new Error('No harmony simulators found. Re-run this command after starting one.');
        }
        var logFilePath = path_1.default.join(process.env.HOME, 'Library/Logs/CoreSimulator', simulatorID, 'system.log');
        return child_process_1.default.spawn('tail', ['-f', logFilePath]);
    };
    HarmonyPlatform.prototype.normalizeLogMessage = function (message) {
        return message;
    };
    return HarmonyPlatform;
}());
var logMessagePrefix = '[CodePush] ';
function processLogData(logData) {
    var _this = this;
    var content = logData.toString();
    content
        .split('\n')
        .filter(function (line) { return line.indexOf(logMessagePrefix) > -1; })
        .map(function (line) {
        // Allow the current platform
        // to normalize the message first.
        line = _this.normalizeLogMessage(line);
        // Strip the CodePush-specific, platform agnostic
        // log message prefix that is added to each entry.
        var message = line.substring(line.indexOf(logMessagePrefix) + logMessagePrefix.length);
        var timeStamp = (0, moment_1.default)().format('hh:mm:ss');
        return "[".concat(timeStamp, "] ").concat(message);
    })
        .forEach(function (line) { return console.log(line); });
}
var debugPlatforms = {
    android: new AndroidDebugPlatform(),
    ios: new iOSDebugPlatform(),
    harmony: new HarmonyPlatform()
};
function default_1(command) {
    return new Promise(function (resolve, reject) {
        var platform = command.platform.toLowerCase();
        var debugPlatform = debugPlatforms[platform];
        if (!debugPlatform) {
            var availablePlatforms = Object.getOwnPropertyNames(debugPlatforms);
            return reject(new Error("\"".concat(platform, "\" is an unsupported platform. Available options are ").concat(availablePlatforms.join(', '), ".")));
        }
        try {
            var logProcess = debugPlatform.getLogProcess();
            console.log("Listening for ".concat(platform, " debug logs (Press CTRL+C to exit)"));
            logProcess.stdout.on('data', processLogData.bind(debugPlatform));
            logProcess.stderr.on('data', reject);
            logProcess.on('close', resolve);
        }
        catch (e) {
            reject(e);
        }
    });
}
exports.default = default_1;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCordovaProjectAppVersion = void 0;
var xml2js_1 = __importDefault(require("xml2js"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
function getCordovaProjectAppVersion(projectRoot) {
    return new Promise(function (resolve, reject) {
        var configString;
        try {
            projectRoot = projectRoot || process.cwd();
            configString = fs_1.default.readFileSync(path_1.default.join(projectRoot, 'config.xml'), {
                encoding: 'utf8',
            });
        }
        catch (error) {
            return reject(new Error("Unable to find or read \"config.xml\" in the CWD. The \"release-cordova\" command must be executed in a Cordova project folder."));
        }
        xml2js_1.default.parseString(configString, function (err, parsedConfig) {
            if (err) {
                reject(new Error("Unable to parse \"config.xml\" in the CWD. Ensure that the contents of \"config.xml\" is valid XML."));
            }
            var config = parsedConfig.widget;
            resolve(config['$'].version);
        });
    });
}
exports.getCordovaProjectAppVersion = getCordovaProjectAppVersion;

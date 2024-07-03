"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileDoesNotExistOrIsDirectory = exports.generateRandomFilename = exports.isDirectory = exports.isBinaryOrZip = void 0;
var fs_1 = __importDefault(require("fs"));
function isBinaryOrZip(path) {
    return (path.search(/\.zip$/i) !== -1 ||
        path.search(/\.apk$/i) !== -1 ||
        path.search(/\.ipa$/i) !== -1);
}
exports.isBinaryOrZip = isBinaryOrZip;
function isDirectory(path) {
    return fs_1.default.statSync(path).isDirectory();
}
exports.isDirectory = isDirectory;
function generateRandomFilename(length) {
    var filename = '';
    var validChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++) {
        // eslint-disable-next-line no-restricted-properties
        filename += validChar.charAt(Math.floor(Math.random() * validChar.length));
    }
    return filename;
}
exports.generateRandomFilename = generateRandomFilename;
function fileDoesNotExistOrIsDirectory(path) {
    try {
        return isDirectory(path);
    }
    catch (error) {
        return true;
    }
}
exports.fileDoesNotExistOrIsDirectory = fileDoesNotExistOrIsDirectory;

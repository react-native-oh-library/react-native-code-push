"use strict";
// Management for the "--debug" flag
// Just a global switch, individual commands/utilities need to check
// if needed to vary their behavior. Typically handled directly
// by the methods on out.
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFormatCsv = exports.formatIsCsv = exports.supportsCsv = exports.setFormatJson = exports.formatIsJson = exports.formatIsParsingCompatible = exports.setQuiet = exports.isQuiet = exports.setDebug = exports.isDebug = void 0;
var debug = false;
function isDebug() {
    return debug;
}
exports.isDebug = isDebug;
function setDebug() {
    debug = true;
}
exports.setDebug = setDebug;
var quiet = false;
function isQuiet() {
    return quiet;
}
exports.isQuiet = isQuiet;
function setQuiet() {
    quiet = true;
}
exports.setQuiet = setQuiet;
var format = 'list';
// Can be used to prevent output which will make output un-parsable
function formatIsParsingCompatible() {
    return format === 'json' || format === 'csv';
}
exports.formatIsParsingCompatible = formatIsParsingCompatible;
function formatIsJson() {
    return format === 'json';
}
exports.formatIsJson = formatIsJson;
function setFormatJson() {
    format = 'json';
}
exports.setFormatJson = setFormatJson;
function supportsCsv(supportedFormats) {
    supportedFormats['csv'] = setFormatCsv;
}
exports.supportsCsv = supportsCsv;
function formatIsCsv() {
    return format === 'csv';
}
exports.formatIsCsv = formatIsCsv;
function setFormatCsv() {
    format = 'csv';
}
exports.setFormatCsv = setFormatCsv;

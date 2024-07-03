"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLowVersion = exports.isValidRange = exports.isValidVersion = void 0;
var semver_1 = __importDefault(require("semver"));
var regexpForMajor = /^\d+$/;
var regexpForMajorMinor = /^\d+\.\d+$/;
// Check if the given string is a semver-compliant version number (e.g. '1.2.3')
// (missing minor/patch values will be added on server side to pass semver.satisfies check)
function isValidVersion(version) {
    return (!!semver_1.default.valid(version) || regexpForMajorMinor.test(version) || regexpForMajor.test(version));
}
exports.isValidVersion = isValidVersion;
// Allow plain integer versions (as well as '1.0' values) for now, e.g. '1' is valid here and we assume that it is equal to '1.0.0'.
function isValidRange(semverRange) {
    return !!semver_1.default.validRange(semverRange);
}
exports.isValidRange = isValidRange;
function isLowVersion(v1, v2) {
    return semver_1.default.compare(v1, v2) === -1 ? true : false;
}
exports.isLowVersion = isLowVersion;

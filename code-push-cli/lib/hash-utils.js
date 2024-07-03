"use strict";
/**
 * NOTE!!! This utility file is duplicated for use by the CodePush service (for server-driven hashing/
 * integrity checks) and Management SDK (for end-to-end code signing), please keep them in sync.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageManifest = exports.hashStream = exports.hashFile = exports.generatePackageManifestFromDirectory = exports.generatePackageHashFromDirectory = void 0;
var crypto_1 = __importDefault(require("crypto"));
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var recursive_fs_1 = __importDefault(require("recursive-fs"));
var HASH_ALGORITHM = 'sha256';
function generatePackageHashFromDirectory(directoryPath, basePath) {
    if (!fs_1.default.lstatSync(directoryPath).isDirectory()) {
        throw new Error('Not a directory. Please either create a directory, or use hashFile().');
    }
    return generatePackageManifestFromDirectory(directoryPath, basePath).then(function (manifest) {
        return manifest.computePackageHash();
    });
}
exports.generatePackageHashFromDirectory = generatePackageHashFromDirectory;
function generatePackageManifestFromDirectory(directoryPath, basePath) {
    var _this = this;
    return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
        var fileHashesMap, files, generateManifestPromise, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fileHashesMap = new Map();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, recursive_fs_1.default.read(directoryPath)];
                case 2:
                    files = (_a.sent()).files;
                    if (!files || files.length === 0) {
                        reject("Error: Can't sign the release because no files were found.");
                        return [2 /*return*/];
                    }
                    generateManifestPromise = files.reduce(function (soFar, filePath) {
                        return soFar.then(function () {
                            var relativePath = PackageManifest.normalizePath(path_1.default.relative(basePath, filePath));
                            if (!PackageManifest.isIgnored(relativePath)) {
                                return hashFile(filePath).then(function (hash) {
                                    fileHashesMap.set(relativePath, hash);
                                });
                            }
                        });
                    }, Promise.resolve(null));
                    generateManifestPromise.then(function () {
                        resolve(new PackageManifest(fileHashesMap));
                    }, reject);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    reject(error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
}
exports.generatePackageManifestFromDirectory = generatePackageManifestFromDirectory;
function hashFile(filePath) {
    var readStream = fs_1.default.createReadStream(filePath);
    return hashStream(readStream);
}
exports.hashFile = hashFile;
function hashStream(readStream) {
    var hashStream = crypto_1.default.createHash(HASH_ALGORITHM);
    var isPending = true;
    return new Promise(function (resolve, reject) {
        readStream
            .on('error', function (error) {
            if (isPending) {
                isPending = false;
                hashStream.end();
                reject(error);
            }
        })
            .on('end', function () {
            if (isPending) {
                isPending = false;
                hashStream.end();
                var buffer = hashStream.read();
                var hash = buffer.toString('hex');
                resolve(hash);
            }
        });
        readStream.pipe(hashStream);
    });
}
exports.hashStream = hashStream;
var PackageManifest = /** @class */ (function () {
    function PackageManifest(map) {
        if (!map) {
            map = new Map();
        }
        this._map = map;
    }
    PackageManifest.prototype.toMap = function () {
        return this._map;
    };
    PackageManifest.prototype.computePackageHash = function () {
        var entries = [];
        this._map.forEach(function (hash, name) {
            entries.push(name + ':' + hash);
        });
        // Make sure this list is alphabetically ordered so that other clients
        // can also compute this hash easily given the update contents.
        entries = entries.sort();
        return crypto_1.default.createHash(HASH_ALGORITHM).update(JSON.stringify(entries)).digest('hex');
    };
    PackageManifest.prototype.serialize = function () {
        var obj = {};
        this._map.forEach(function (value, key) {
            obj[key] = value;
        });
        return JSON.stringify(obj);
    };
    PackageManifest.deserialize = function (serializedContents) {
        try {
            var obj = JSON.parse(serializedContents);
            var map = new Map();
            for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
                var key = _a[_i];
                map.set(key, obj[key]);
            }
            return new PackageManifest(map);
        }
        catch (e) { }
    };
    PackageManifest.normalizePath = function (filePath) {
        //replace all backslashes coming from cli running on windows machines by slashes
        return filePath.replace(/\\/g, '/');
    };
    PackageManifest.isIgnored = function (relativeFilePath) {
        var __MACOSX = '__MACOSX/';
        var DS_STORE = '.DS_Store';
        var CODEPUSH_METADATA = '.codepushrelease';
        return (startsWith(relativeFilePath, __MACOSX) ||
            relativeFilePath === DS_STORE ||
            endsWith(relativeFilePath, '/' + DS_STORE) ||
            relativeFilePath === CODEPUSH_METADATA ||
            endsWith(relativeFilePath, '/' + CODEPUSH_METADATA));
    };
    return PackageManifest;
}());
exports.PackageManifest = PackageManifest;
function startsWith(str, prefix) {
    return str && str.substring(0, prefix.length) === prefix;
}
function endsWith(str, suffix) {
    return str && str.indexOf(suffix, str.length - suffix.length) !== -1;
}

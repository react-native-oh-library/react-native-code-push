"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseReact = exports.releaseCordova = exports.release = exports.execute = exports.deploymentList = exports.createEmptyTempReleaseFolder = exports.confirm = exports.execSync = exports.spawn = exports.sdk = void 0;
var AccountManager = require("code-push");
var chalk_1 = __importDefault(require("chalk"));
var child_process_1 = __importDefault(require("child_process"));
var debug_1 = __importDefault(require("./commands/debug"));
var fs_1 = __importDefault(require("fs"));
var mkdirp = require('mkdirp');
var moment_1 = __importDefault(require("moment"));
var opener = require('opener');
var os_1 = __importDefault(require("os"));
var path_1 = __importDefault(require("path"));
var prompt = require('prompt');
var rimraf_1 = __importDefault(require("rimraf"));
var which_1 = __importDefault(require("which"));
var wordwrap = require("wordwrap");
var email_validator_1 = __importDefault(require("email-validator"));
var cli = __importStar(require("./definitions/cli"));
var index_1 = __importDefault(require("./release-hooks/index"));
var react_native_utils_1 = require("./lib/react-native-utils");
var file_utils_1 = require("./lib/file-utils");
var interaction_1 = require("./util/interaction");
var cordova_utils_1 = require("./lib/cordova-utils");
var configFilePath = path_1.default.join(process.env.LOCALAPPDATA || process.env.HOME, '.code-push.config');
var packageJson = require('../package.json');
var CLI_HEADERS = {
    'X-CodePush-CLI-Version': packageJson.version,
};
exports.spawn = child_process_1.default.spawn;
exports.execSync = child_process_1.default.execSync;
var connectionInfo;
var confirm = function (message) {
    if (message === void 0) { message = 'Are you sure?'; }
    message += ' (y/N):';
    return new Promise(function (resolve) {
        prompt.message = '';
        prompt.delimiter = '';
        prompt.start();
        prompt.get({
            properties: {
                response: {
                    description: chalk_1.default.cyan(message),
                },
            },
        }, function (err, result) {
            var accepted = result.response && result.response.toLowerCase() === 'y';
            var rejected = !result.response || result.response.toLowerCase() === 'n';
            if (accepted) {
                resolve(true);
            }
            else {
                if (!rejected) {
                    interaction_1.out.text('Invalid response: "' + result.response + '"');
                }
                resolve(false);
            }
        });
    });
};
exports.confirm = confirm;
function accessKeyAdd(command) {
    return exports.sdk.addAccessKey(command.name, command.ttl).then(function (accessKey) {
        interaction_1.out.text("Successfully created the \"".concat(command.name, "\" access key: ").concat(accessKey.key));
        interaction_1.out.text("Make sure to save this key value somewhere safe, since you won't be able to view it from the CLI again!");
    });
}
function accessKeyPatch(command) {
    var willUpdateName = isCommandOptionSpecified(command.newName) && command.oldName !== command.newName;
    var willUpdateTtl = isCommandOptionSpecified(command.ttl);
    if (!willUpdateName && !willUpdateTtl) {
        throw new Error('A new name and/or TTL must be provided.');
    }
    return exports.sdk
        .patchAccessKey(command.oldName, command.newName, command.ttl)
        .then(function (accessKey) {
        var logMessage = 'Successfully ';
        if (willUpdateName) {
            logMessage += "renamed the access key \"".concat(command.oldName, "\" to \"").concat(command.newName, "\"");
        }
        if (willUpdateTtl) {
            var expirationDate = (0, moment_1.default)(accessKey.expires).format('LLLL');
            if (willUpdateName) {
                logMessage += " and changed its expiration date to ".concat(expirationDate);
            }
            else {
                logMessage += "changed the expiration date of the \"".concat(command.oldName, "\" access key to ").concat(expirationDate);
            }
        }
        interaction_1.out.text("".concat(logMessage, "."));
    });
}
function accessKeyList(command) {
    throwForInvalidOutputFormat(command.format);
    return exports.sdk.getAccessKeys().then(function (accessKeys) {
        printAccessKeys(command.format, accessKeys);
    });
}
function accessKeyRemove(command) {
    return (0, exports.confirm)().then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk.removeAccessKey(command.accessKey).then(function () {
                interaction_1.out.text("Successfully removed the \"".concat(command.accessKey, "\" access key."));
            });
        }
        interaction_1.out.text('Access key removal cancelled.');
    });
}
function appAdd(command) {
    // Validate the OS and platform, doing a case insensitve comparison. Note that for CLI examples we
    // present these values in all lower case, per CLI conventions, but when passed to the REST API the
    // are in mixed case, per Mobile Center API naming conventions
    var os;
    var normalizedOs = command.os.toLowerCase();
    if (normalizedOs === 'ios') {
        os = 'iOS';
    }
    else if (normalizedOs === 'android') {
        os = 'Android';
    }
    else if (normalizedOs === 'windows') {
        os = 'Windows';
    }
    else if (normalizedOs === 'harmony') {
        os = 'Harmony';
    }
    else {
        return Promise.reject(new Error("\"".concat(command.os, "\" is an unsupported OS. Available options are \"ios\", \"android\", \"windows\" and \"harmony\".")));
    }
    var platform;
    var normalizedPlatform = command.platform.toLowerCase();
    if (normalizedPlatform === 'react-native') {
        platform = 'React-Native';
    }
    else if (normalizedPlatform === 'cordova') {
        platform = 'Cordova';
    }
    else {
        return Promise.reject(new Error("\"".concat(command.platform, "\" is an unsupported platform. Available options are \"react-native\" and \"cordova\".")));
    }
    return exports.sdk.addApp(command.appName, os, platform, false).then(function (app) {
        interaction_1.out.text('Successfully added the "' +
            command.appName +
            '" app, along with the following default deployments:');
        var deploymentListCommand = {
            type: cli.CommandType.deploymentList,
            appName: app.name,
            format: 'table',
            displayKeys: true,
        };
        return (0, exports.deploymentList)(deploymentListCommand, /*showPackage=*/ false);
    });
}
function appList(command) {
    throwForInvalidOutputFormat(command.format);
    var apps;
    return exports.sdk.getApps().then(function (retrievedApps) {
        printAppList(command.format, retrievedApps);
    });
}
function appRemove(command) {
    return (0, exports.confirm)('Are you sure you want to remove this app? Note that its deployment keys will be PERMANENTLY unrecoverable.').then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk.removeApp(command.appName).then(function () {
                interaction_1.out.text('Successfully removed the "' + command.appName + '" app.');
            });
        }
        interaction_1.out.text('App removal cancelled.');
    });
}
function appRename(command) {
    return exports.sdk.renameApp(command.currentAppName, command.newAppName).then(function () {
        interaction_1.out.text('Successfully renamed the "' +
            command.currentAppName +
            '" app to "' +
            command.newAppName +
            '".');
    });
}
var createEmptyTempReleaseFolder = function (folderPath) {
    return deleteFolder(folderPath).then(function () {
        fs_1.default.mkdirSync(folderPath);
    });
};
exports.createEmptyTempReleaseFolder = createEmptyTempReleaseFolder;
function appTransfer(command) {
    throwForInvalidEmail(command.email);
    return (0, exports.confirm)().then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk.transferApp(command.appName, command.email).then(function () {
                interaction_1.out.text('Successfully transferred the ownership of app "' +
                    command.appName +
                    '" to the account with email "' +
                    command.email +
                    '".');
            });
        }
        interaction_1.out.text('App transfer cancelled.');
    });
}
function addCollaborator(command) {
    throwForInvalidEmail(command.email);
    return exports.sdk.addCollaborator(command.appName, command.email).then(function () {
        interaction_1.out.text('Collaborator invitation email for "' +
            command.appName +
            '" sent to "' +
            command.email +
            '".');
    });
}
function listCollaborators(command) {
    throwForInvalidOutputFormat(command.format);
    return exports.sdk
        .getCollaborators(command.appName)
        .then(function (retrievedCollaborators) {
        printCollaboratorsList(command.format, retrievedCollaborators);
    });
}
function removeCollaborator(command) {
    throwForInvalidEmail(command.email);
    return (0, exports.confirm)().then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk.removeCollaborator(command.appName, command.email).then(function () {
                interaction_1.out.text('Successfully removed "' +
                    command.email +
                    '" as a collaborator from the app "' +
                    command.appName +
                    '".');
            });
        }
        interaction_1.out.text('App collaborator removal cancelled.');
    });
}
function deleteConnectionInfoCache(printMessage) {
    if (printMessage === void 0) { printMessage = true; }
    try {
        fs_1.default.unlinkSync(configFilePath);
        if (printMessage) {
            interaction_1.out.text("Successfully logged-out. The session file located at ".concat(chalk_1.default.cyan(configFilePath), " has been deleted.\r\n"));
        }
    }
    catch (ex) { }
}
function deleteFolder(folderPath) {
    return new Promise(function (resolve, reject) {
        (0, rimraf_1.default)(folderPath, function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(null);
            }
        });
    });
}
function deploymentAdd(command) {
    if (command.default) {
        return exports.sdk
            .addDeployment(command.appName, 'Staging')
            .then(function (deployment) {
            return exports.sdk.addDeployment(command.appName, 'Production');
        })
            .then(function (deployment) {
            interaction_1.out.text('Successfully added the "Staging" and "Production" default deployments:');
            var deploymentListCommand = {
                type: cli.CommandType.deploymentList,
                appName: command.appName,
                format: 'table',
                displayKeys: true,
            };
            return (0, exports.deploymentList)(deploymentListCommand, /*showPackage=*/ false);
        });
    }
    else {
        return exports.sdk
            .addDeployment(command.appName, command.deploymentName)
            .then(function (deployment) {
            interaction_1.out.text('Successfully added the "' +
                command.deploymentName +
                '" deployment with key "' +
                deployment.key +
                '" to the "' +
                command.appName +
                '" app.');
        });
    }
}
function deploymentHistoryClear(command) {
    return (0, exports.confirm)().then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk
                .clearDeploymentHistory(command.appName, command.deploymentName)
                .then(function () {
                interaction_1.out.text('Successfully cleared the release history associated with the "' +
                    command.deploymentName +
                    '" deployment from the "' +
                    command.appName +
                    '" app.');
            });
        }
        interaction_1.out.text('Clear deployment cancelled.');
    });
}
var deploymentList = function (command, showPackage) {
    if (showPackage === void 0) { showPackage = true; }
    throwForInvalidOutputFormat(command.format);
    var deployments;
    return exports.sdk
        .getDeployments(command.appName)
        .then(function (retrievedDeployments) {
        deployments = retrievedDeployments;
        if (showPackage) {
            var metricsPromises = deployments.map(function (deployment) {
                if (deployment.package) {
                    return exports.sdk
                        .getDeploymentMetrics(command.appName, deployment.name)
                        .then(function (metrics) {
                        if (metrics[deployment.package.label]) {
                            var totalActive = getTotalActiveFromDeploymentMetrics(metrics);
                            deployment.package.metrics = {
                                active: metrics[deployment.package.label].active,
                                downloaded: metrics[deployment.package.label].downloaded,
                                failed: metrics[deployment.package.label].failed,
                                installed: metrics[deployment.package.label].installed,
                                totalActive: totalActive,
                            };
                        }
                    });
                }
                else {
                    return Promise.resolve(null);
                }
            });
            return Promise.all(metricsPromises);
        }
    })
        .then(function () {
        printDeploymentList(command, deployments, showPackage);
    });
};
exports.deploymentList = deploymentList;
function deploymentRemove(command) {
    return (0, exports.confirm)('Are you sure you want to remove this deployment? Note that its deployment key will be PERMANENTLY unrecoverable.').then(function (wasConfirmed) {
        if (wasConfirmed) {
            return exports.sdk.removeDeployment(command.appName, command.deploymentName).then(function () {
                interaction_1.out.text('Successfully removed the "' +
                    command.deploymentName +
                    '" deployment from the "' +
                    command.appName +
                    '" app.');
            });
        }
        interaction_1.out.text('Deployment removal cancelled.');
    });
}
function deploymentRename(command) {
    return exports.sdk
        .renameDeployment(command.appName, command.currentDeploymentName, command.newDeploymentName)
        .then(function () {
        interaction_1.out.text('Successfully renamed the "' +
            command.currentDeploymentName +
            '" deployment to "' +
            command.newDeploymentName +
            '" for the "' +
            command.appName +
            '" app.');
    });
}
function deploymentHistory(command) {
    throwForInvalidOutputFormat(command.format);
    return Promise.all([
        exports.sdk.getAccountInfo(),
        exports.sdk.getDeploymentHistory(command.appName, command.deploymentName),
        exports.sdk.getDeploymentMetrics(command.appName, command.deploymentName),
    ]).then(function (_a) {
        var account = _a[0], deploymentHistory = _a[1], metrics = _a[2];
        var totalActive = getTotalActiveFromDeploymentMetrics(metrics);
        deploymentHistory.forEach(function (packageObject) {
            if (metrics[packageObject.label]) {
                packageObject.metrics = {
                    active: metrics[packageObject.label].active,
                    downloaded: metrics[packageObject.label].downloaded,
                    failed: metrics[packageObject.label].failed,
                    installed: metrics[packageObject.label].installed,
                    totalActive: totalActive,
                };
            }
        });
        printDeploymentHistory(command, deploymentHistory, account.email);
    });
}
function deserializeConnectionInfo() {
    try {
        var savedConnection = fs_1.default.readFileSync(configFilePath, {
            encoding: 'utf8',
        });
        var connectionInfo = JSON.parse(savedConnection);
        // If the connection info is in the legacy format, convert it to the modern format
        if (connectionInfo.accessKeyName) {
            connectionInfo = {
                accessKey: connectionInfo.accessKeyName,
            };
        }
        var connInfo = connectionInfo;
        connInfo.proxy = getProxy(connInfo.proxy, connInfo.noProxy);
        return connInfo;
    }
    catch (ex) {
        return;
    }
}
function execute(command) {
    connectionInfo = deserializeConnectionInfo();
    return Promise.resolve().then(function () {
        switch (command.type) {
            // Must not be logged in
            case cli.CommandType.login:
            case cli.CommandType.register:
                if (connectionInfo) {
                    throw new Error('You are already logged in from this machine.');
                }
                break;
            // It does not matter whether you are logged in or not
            case cli.CommandType.link:
                break;
            // Must be logged in
            default:
                if (!!exports.sdk)
                    break; // Used by unit tests to skip authentication
                if (!connectionInfo) {
                    throw new Error("You are not currently logged in. Run the 'code-push login' command to authenticate with the CodePush server.");
                }
                exports.sdk = getSdk(connectionInfo.accessKey, CLI_HEADERS, connectionInfo.customServerUrl, connectionInfo.proxy);
                break;
        }
        switch (command.type) {
            case cli.CommandType.accessKeyAdd:
                return accessKeyAdd(command);
            case cli.CommandType.accessKeyPatch:
                return accessKeyPatch(command);
            case cli.CommandType.accessKeyList:
                return accessKeyList(command);
            case cli.CommandType.accessKeyRemove:
                return accessKeyRemove(command);
            case cli.CommandType.appAdd:
                return appAdd(command);
            case cli.CommandType.appList:
                return appList(command);
            case cli.CommandType.appRemove:
                return appRemove(command);
            case cli.CommandType.appRename:
                return appRename(command);
            case cli.CommandType.appTransfer:
                return appTransfer(command);
            case cli.CommandType.collaboratorAdd:
                return addCollaborator(command);
            case cli.CommandType.collaboratorList:
                return listCollaborators(command);
            case cli.CommandType.collaboratorRemove:
                return removeCollaborator(command);
            case cli.CommandType.debug:
                return (0, debug_1.default)(command);
            case cli.CommandType.deploymentAdd:
                return deploymentAdd(command);
            case cli.CommandType.deploymentHistoryClear:
                return deploymentHistoryClear(command);
            case cli.CommandType.deploymentHistory:
                return deploymentHistory(command);
            case cli.CommandType.deploymentList:
                return (0, exports.deploymentList)(command);
            case cli.CommandType.deploymentRemove:
                return deploymentRemove(command);
            case cli.CommandType.deploymentRename:
                return deploymentRename(command);
            case cli.CommandType.link:
                return link(command);
            case cli.CommandType.login:
                return login(command);
            case cli.CommandType.logout:
                return logout(command);
            case cli.CommandType.patch:
                return patch(command);
            case cli.CommandType.promote:
                return promote(command);
            case cli.CommandType.register:
                return register(command);
            case cli.CommandType.release:
                return (0, exports.release)(command);
            case cli.CommandType.releaseCordova:
                return (0, exports.releaseCordova)(command);
            case cli.CommandType.releaseReact:
                return (0, exports.releaseReact)(command);
            case cli.CommandType.rollback:
                return rollback(command);
            case cli.CommandType.whoami:
                return whoami(command);
            default:
                // We should never see this message as invalid commands should be caught by the argument parser.
                throw new Error('Invalid command:  ' + JSON.stringify(command));
        }
    });
}
exports.execute = execute;
function fileDoesNotExistOrIsDirectory(filePath) {
    try {
        return fs_1.default.lstatSync(filePath).isDirectory();
    }
    catch (error) {
        return true;
    }
}
function getTotalActiveFromDeploymentMetrics(metrics) {
    var totalActive = 0;
    Object.keys(metrics).forEach(function (label) {
        totalActive += metrics[label].active;
    });
    return totalActive;
}
function initiateExternalAuthenticationAsync(action, serverUrl) {
    var message;
    if (action === 'link') {
        message = "Please login to Mobile Center in the browser window we've just opened.\nIf you login with an additional authentication provider (e.g. GitHub) that shares the same email address, it will be linked to your current Mobile Center account.";
        // For "link" there shouldn't be a token prompt, so we go straight to the Mobile Center URL to avoid that
        interaction_1.out.text(message);
        var url = serverUrl || AccountManager.MOBILE_CENTER_SERVER_URL;
        opener(url);
    }
    else {
        // We use this now for both login & register
        message = "Please login to Mobile Center in the browser window we've just opened.";
        interaction_1.out.text(message);
        var hostname = os_1.default.hostname();
        var url = "".concat(serverUrl || AccountManager.SERVER_URL, "/auth/").concat(action, "?hostname=").concat(hostname);
        opener(url);
    }
}
function link(command) {
    initiateExternalAuthenticationAsync('link', command.serverUrl);
    return Promise.resolve();
}
function login(command) {
    // Check if one of the flags were provided.
    if (command.accessKey) {
        var proxy = getProxy(command.proxy, command.noProxy);
        exports.sdk = getSdk(command.accessKey, CLI_HEADERS, command.serverUrl, proxy);
        return exports.sdk.isAuthenticated().then(function (isAuthenticated) {
            if (isAuthenticated) {
                serializeConnectionInfo(command.accessKey, 
                /*preserveAccessKeyOnLogout*/ true, command.serverUrl, command.proxy, command.noProxy);
            }
            else {
                throw new Error('Invalid access key.');
            }
        });
    }
    else {
        return loginWithExternalAuthentication('login', command.serverUrl, command.proxy, command.noProxy);
    }
}
function loginWithExternalAuthentication(action, serverUrl, proxy, noProxy) {
    initiateExternalAuthenticationAsync(action, serverUrl);
    interaction_1.out.text(''); // Insert newline
    return requestAccessKey().then(function (accessKey) {
        if (accessKey === null) {
            // The user has aborted the synchronous prompt (e.g.:  via [CTRL]+[C]).
            return;
        }
        exports.sdk = getSdk(accessKey, CLI_HEADERS, serverUrl, getProxy(proxy, noProxy));
        return exports.sdk.isAuthenticated().then(function (isAuthenticated) {
            if (isAuthenticated) {
                serializeConnectionInfo(accessKey, 
                /*preserveAccessKeyOnLogout*/ false, serverUrl, proxy, noProxy);
            }
            else {
                throw new Error('Invalid token.');
            }
        });
    });
}
function logout(command) {
    return Promise.resolve()
        .then(function () {
        if (!connectionInfo.preserveAccessKeyOnLogout) {
            var machineName = os_1.default.hostname();
            return exports.sdk.removeSession(machineName).catch(function (error) {
                // If we are not authenticated or the session doesn't exist anymore, just swallow the error instead of displaying it
                if (error.statusCode !== AccountManager.ERROR_UNAUTHORIZED &&
                    error.statusCode !== AccountManager.ERROR_NOT_FOUND) {
                    throw error;
                }
            });
        }
    })
        .then(function () {
        exports.sdk = null;
        deleteConnectionInfoCache();
    });
}
function formatDate(unixOffset) {
    var date = (0, moment_1.default)(unixOffset);
    var now = (0, moment_1.default)();
    if (Math.abs(now.diff(date, 'days')) < 30) {
        return date.fromNow(); // "2 hours ago"
    }
    else if (now.year() === date.year()) {
        return date.format('MMM D'); // "Nov 6"
    }
    else {
        return date.format('MMM D, YYYY'); // "Nov 6, 2014"
    }
}
function printAppList(format, apps) {
    if (format === 'json') {
        printJson(apps);
    }
    else if (format === 'table') {
        interaction_1.out.table(interaction_1.out.getCommandOutputTableOptions(generateColoredTableTitles(['Name', 'Deployments'])), apps.map(function (app) { return [app.name, wordwrap(50)(app.deployments.join(', '))]; }));
    }
}
function getCollaboratorDisplayName(email, collaboratorProperties) {
    return collaboratorProperties.permission === AccountManager.AppPermission.OWNER
        ? email + chalk_1.default.magenta(' (Owner)')
        : email;
}
function printCollaboratorsList(format, collaborators) {
    if (format === 'json') {
        var dataSource = { collaborators: collaborators };
        printJson(dataSource);
    }
    else if (format === 'table') {
        interaction_1.out.table(interaction_1.out.getCommandOutputTableOptions(generateColoredTableTitles(['E-mail Address'])), collaborators.map(function (email) { return [getCollaboratorDisplayName(email, collaborators[email])]; }));
    }
}
function printDeploymentList(command, deployments, showPackage) {
    if (showPackage === void 0) { showPackage = true; }
    if (command.format === 'json') {
        printJson(deployments);
    }
    else if (command.format === 'table') {
        var headers = ['Name'];
        if (command.displayKeys) {
            headers.push('Deployment Key');
        }
        if (showPackage) {
            headers.push('Update Metadata');
            headers.push('Install Metrics');
        }
        interaction_1.out.table(interaction_1.out.getCommandOutputTableOptions(generateColoredTableTitles(headers)), deployments.map(function (deployment) {
            var row = [deployment.name];
            if (command.displayKeys) {
                row.push(deployment.key);
            }
            if (showPackage) {
                row.push(getPackageString(deployment.package));
                row.push(getPackageMetricsString(deployment.package));
            }
            return row;
        }));
    }
}
function printDeploymentHistory(command, deploymentHistory, currentUserEmail) {
    if (command.format === 'json') {
        printJson(deploymentHistory);
    }
    else if (command.format === 'table') {
        var headers = ['Label', 'Release Time', 'App Version', 'Mandatory'];
        if (command.displayAuthor) {
            headers.push('Released By');
        }
        headers.push('Description', 'Install Metrics');
        interaction_1.out.table(interaction_1.out.getCommandOutputTableOptions(generateColoredTableTitles(headers)), deploymentHistory.map(function (packageObject) {
            var releaseTime = formatDate(packageObject.uploadTime);
            var releaseSource;
            if (packageObject.releaseMethod === 'Promote') {
                releaseSource = "Promoted ".concat(packageObject.originalLabel, " from \"").concat(packageObject.originalDeployment, "\"");
            }
            else if (packageObject.releaseMethod === 'Rollback') {
                var labelNumber = parseInt(packageObject.label.substring(1));
                var lastLabel = 'v' + (labelNumber - 1);
                releaseSource = "Rolled back ".concat(lastLabel, " to ").concat(packageObject.originalLabel);
            }
            if (releaseSource) {
                releaseTime += '\n' + chalk_1.default.magenta("(".concat(releaseSource, ")")).toString();
            }
            var row = [
                packageObject.label,
                releaseTime,
                packageObject.appVersion,
                packageObject.isMandatory ? 'Yes' : 'No',
            ];
            if (command.displayAuthor) {
                var releasedBy = packageObject.releasedBy
                    ? packageObject.releasedBy
                    : '';
                if (currentUserEmail && releasedBy === currentUserEmail) {
                    releasedBy = 'You';
                }
                row.push(releasedBy);
            }
            row.push(packageObject.description ? wordwrap(30)(packageObject.description) : '');
            row.push(getPackageMetricsString(packageObject) +
                (packageObject.isDisabled ? "\n".concat(chalk_1.default.green('Disabled:'), " Yes") : ''));
            if (packageObject.isDisabled) {
                row = row.map(function (cellContents) {
                    return applyChalkSkippingLineBreaks(cellContents, chalk_1.default.dim);
                });
            }
            return row;
        }));
    }
}
function applyChalkSkippingLineBreaks(applyString, chalkMethod) {
    // Used to prevent "chalk" from applying styles to linebreaks which
    // causes table border chars to have the style applied as well.
    return applyString
        .split('\n')
        .map(function (token) { return chalkMethod(token); })
        .join('\n');
}
function getPackageString(packageObject) {
    if (!packageObject) {
        return chalk_1.default.magenta('No updates released').toString();
    }
    var packageString = chalk_1.default.green('Label: ') +
        packageObject.label +
        '\n' +
        chalk_1.default.green('App Version: ') +
        packageObject.appVersion +
        '\n' +
        chalk_1.default.green('Mandatory: ') +
        (packageObject.isMandatory ? 'Yes' : 'No') +
        '\n' +
        chalk_1.default.green('Release Time: ') +
        formatDate(packageObject.uploadTime) +
        '\n' +
        chalk_1.default.green('Released By: ') +
        (packageObject.releasedBy ? packageObject.releasedBy : '') +
        (packageObject.description
            ? wordwrap(70)('\n' + chalk_1.default.green('Description: ') + packageObject.description)
            : '');
    if (packageObject.isDisabled) {
        packageString += "\n".concat(chalk_1.default.green('Disabled:'), " Yes");
    }
    return packageString;
}
function getPackageMetricsString(obj) {
    var packageObject = obj;
    var rolloutString = obj && obj.rollout && obj.rollout !== 100
        ? "\n".concat(chalk_1.default.green('Rollout:'), " ").concat(obj.rollout.toLocaleString(), "%")
        : '';
    if (!packageObject || !packageObject.metrics) {
        return chalk_1.default.magenta('No installs recorded').toString() + (rolloutString || '');
    }
    var activePercent = packageObject.metrics.totalActive
        ? (packageObject.metrics.active / packageObject.metrics.totalActive) * 100
        : 0.0;
    var percentString;
    if (activePercent === 100.0) {
        percentString = '100%';
    }
    else if (activePercent === 0.0) {
        percentString = '0%';
    }
    else {
        percentString = activePercent.toPrecision(2) + '%';
    }
    var numPending = packageObject.metrics.downloaded -
        packageObject.metrics.installed -
        packageObject.metrics.failed;
    var returnString = chalk_1.default.green('Active: ') +
        percentString +
        ' (' +
        packageObject.metrics.active.toLocaleString() +
        ' of ' +
        packageObject.metrics.totalActive.toLocaleString() +
        ')\n' +
        chalk_1.default.green('Total: ') +
        packageObject.metrics.installed.toLocaleString();
    if (numPending > 0) {
        returnString += ' (' + numPending.toLocaleString() + ' pending)';
    }
    if (packageObject.metrics.failed) {
        returnString +=
            '\n' +
                chalk_1.default.green('Rollbacks: ') +
                chalk_1.default.red(packageObject.metrics.failed.toLocaleString() + '');
    }
    if (rolloutString) {
        returnString += rolloutString;
    }
    return returnString;
}
function printJson(object) {
    interaction_1.out.text(JSON.stringify(object, /*replacer=*/ null, /*spacing=*/ 2));
}
function printAccessKeys(format, keys) {
    if (format === 'json') {
        printJson(keys);
    }
    else if (format === 'table') {
        var now = new Date().getTime();
        var isExpired = function (key) {
            return now >= key.expires;
        };
        // Access keys never expire in Mobile Center (at least for now--maybe that feature will get added later), so don't show the Expires column anymore
        var keyToTableRow = function (key, dim) {
            var row = [
                key.name,
                key.createdTime ? formatDate(key.createdTime) : '',
                /* formatDate(key.expires) */
            ];
            if (dim) {
                row.forEach(function (col, index) {
                    row[index] = chalk_1.default.dim(col);
                });
            }
            return row;
        };
        interaction_1.out.table(interaction_1.out.getCommandOutputTableOptions(generateColoredTableTitles(['Name', 'Created' /*, "Expires" */])), keys
            .filter(function (key) { return !isExpired(key); })
            .map(function (key) { return keyToTableRow(key, /*dim*/ false); })
            .concat(keys
            .filter(function (key) { return isExpired(key); })
            .map(function (key) { return keyToTableRow(key, /*dim*/ true); })));
    }
}
function generateColoredTableTitles(tableTitles) {
    return tableTitles.map(function (title) { return chalk_1.default.cyan(title); });
}
function register(command) {
    return loginWithExternalAuthentication('register', command.serverUrl, command.proxy, command.noProxy);
}
function promote(command) {
    var packageInfo = {
        appVersion: command.appStoreVersion,
        description: command.description,
        label: command.label,
        isDisabled: command.disabled,
        isMandatory: command.mandatory,
        rollout: command.rollout,
    };
    return exports.sdk
        .promote(command.appName, command.sourceDeploymentName, command.destDeploymentName, packageInfo)
        .then(function () {
        interaction_1.out.text('Successfully promoted ' +
            (command.label ? '"' + command.label + '" of ' : '') +
            'the "' +
            command.sourceDeploymentName +
            '" deployment of the "' +
            command.appName +
            '" app to the "' +
            command.destDeploymentName +
            '" deployment.');
    })
        .catch(function (err) { return releaseErrorHandler(err, command); });
}
function patch(command) {
    var packageInfo = {
        appVersion: command.appStoreVersion,
        description: command.description,
        isMandatory: command.mandatory,
        isDisabled: command.disabled,
        rollout: command.rollout,
    };
    for (var updateProperty in packageInfo) {
        if (packageInfo[updateProperty] !== null) {
            return exports.sdk
                .patchRelease(command.appName, command.deploymentName, command.label, packageInfo)
                .then(function () {
                interaction_1.out.text("Successfully updated the \"".concat(command.label ? command.label : "latest", "\" release of \"").concat(command.appName, "\" app's \"").concat(command.deploymentName, "\" deployment."));
            });
        }
    }
    throw new Error('At least one property must be specified to patch a release.');
}
var release = function (command) {
    if ((0, file_utils_1.isBinaryOrZip)(command.package)) {
        throw new Error("It is unnecessary to package releases in a .zip or binary file. Please specify the direct path to the update content's directory (e.g. /platforms/ios/www) or file (e.g. main.jsbundle).");
    }
    throwForInvalidSemverRange(command.appStoreVersion);
    return Promise.resolve().then(function () {
        // Copy the command so that the original is not modified
        var currentCommand = {
            appName: command.appName,
            appStoreVersion: command.appStoreVersion,
            deploymentName: command.deploymentName,
            description: command.description,
            disabled: command.disabled,
            mandatory: command.mandatory,
            package: command.package,
            rollout: command.rollout,
            privateKeyPath: command.privateKeyPath,
            type: command.type,
        };
        var releaseHooksPromise = index_1.default.reduce(function (accumulatedPromise, hook) {
            return accumulatedPromise.then(function (modifiedCommand) {
                currentCommand = modifiedCommand || currentCommand;
                return hook(currentCommand, command, exports.sdk);
            });
        }, Promise.resolve(currentCommand));
        return releaseHooksPromise
            .then(function () { })
            .catch(function (err) { return releaseErrorHandler(err, command); });
    });
};
exports.release = release;
var releaseCordova = function (command) {
    var releaseCommand = command;
    // Check for app and deployment exist before releasing an update.
    // This validation helps to save about 1 minute or more in case user has typed wrong app or deployment name.
    return validateDeployment(command.appName, command.deploymentName)
        .then(function () {
        var platform = command.platform.toLowerCase();
        var projectRoot = process.cwd();
        var platformFolder = path_1.default.join(projectRoot, 'platforms', platform);
        var outputFolder;
        if (platform === 'ios' || platform === 'harmony') {
            outputFolder = path_1.default.join(platformFolder, 'www');
        }
        else if (platform === 'android') {
            // Since cordova-android 7 assets directory moved to android/app/src/main/assets instead of android/assets
            var outputFolderVer7 = path_1.default.join(platformFolder, 'app', 'src', 'main', 'assets', 'www');
            if (fs_1.default.existsSync(outputFolderVer7)) {
                outputFolder = outputFolderVer7;
            }
            else {
                outputFolder = path_1.default.join(platformFolder, 'assets', 'www');
            }
        }
        else {
            throw new Error('Platform must be either "ios","android" or "harmony".');
        }
        var cordovaCommand = command.build
            ? command.isReleaseBuildType
                ? 'build --release'
                : 'build'
            : 'prepare';
        var cordovaCLI = 'cordova';
        // Check whether the Cordova or PhoneGap CLIs are
        // installed, and if not, fail early
        try {
            which_1.default.sync(cordovaCLI);
        }
        catch (e) {
            try {
                cordovaCLI = 'phonegap';
                which_1.default.sync(cordovaCLI);
            }
            catch (e) {
                throw new Error("Unable to ".concat(cordovaCommand, " project. Please ensure that either the Cordova or PhoneGap CLI is installed."));
            }
        }
        interaction_1.out.text(chalk_1.default.cyan("Running \"".concat(cordovaCLI, " ").concat(cordovaCommand, "\" command:\n")));
        try {
            (0, exports.execSync)([cordovaCLI, cordovaCommand, platform, '--verbose'].join(' '), {
                stdio: 'inherit',
            });
        }
        catch (error) {
            throw new Error("Unable to ".concat(cordovaCommand, " project. Please ensure that the CWD represents a Cordova project and that the \"").concat(platform, "\" platform was added by running \"").concat(cordovaCLI, " platform add ").concat(platform, "\"."));
        }
        releaseCommand.package = outputFolder;
        releaseCommand.type = cli.CommandType.release;
        return (0, cordova_utils_1.getCordovaProjectAppVersion)(projectRoot);
    })
        .then(function (appVersion) {
        var releaseTargetVersion;
        if (command.appStoreVersion) {
            releaseTargetVersion = command.appStoreVersion;
        }
        else {
            releaseTargetVersion = appVersion;
        }
        throwForInvalidSemverRange(releaseTargetVersion);
        releaseCommand.appStoreVersion = releaseTargetVersion;
        interaction_1.out.text(chalk_1.default.cyan('\nReleasing update contents to CodePush:\n'));
        return (0, exports.release)(releaseCommand);
    });
};
exports.releaseCordova = releaseCordova;
var releaseReact = function (command) {
    var bundleName = command.bundleName;
    var entryFile = command.entryFile;
    var outputFolder = command.outputDir || path_1.default.join(os_1.default.tmpdir(), 'CodePush');
    var platform = (command.platform = command.platform.toLowerCase());
    var releaseCommand = command;
    // we have to add "CodePush" root forlder to make update contents file structure
    // to be compatible with React Native client SDK
    outputFolder = path_1.default.join(outputFolder, 'CodePush');
    mkdirp.sync(outputFolder);
    // Check for app and deployment exist before releasing an update.
    // This validation helps to save about 1 minute or more in case user has typed wrong app or deployment name.
    return (validateDeployment(command.appName, command.deploymentName)
        .then(function () {
        releaseCommand.package = outputFolder;
        switch (platform) {
            case 'android':
            case 'ios':
            case 'harmony':
            case 'windows':
                if (!bundleName) {
                    bundleName =
                        platform === 'ios' || platform === 'harmony' ? 'main.jsbundle' : "index.".concat(platform, ".bundle");
                }
                break;
            default:
                throw new Error('Platform must be "android", "ios", "harmony" ,or "windows".');
        }
        try {
            var projectPackageJson = require(path_1.default.join(process.cwd(), 'package.json'));
            var projectName = projectPackageJson.name;
            if (!projectName) {
                throw new Error('The "package.json" file in the CWD does not have the "name" field set.');
            }
            var isReactNativeProject = projectPackageJson.dependencies['react-native'] ||
                (projectPackageJson.devDependencies &&
                    projectPackageJson.devDependencies['react-native']);
            if (!isReactNativeProject) {
                throw new Error('The project in the CWD is not a React Native project.');
            }
        }
        catch (error) {
            throw new Error('Unable to find or read "package.json" in the CWD. The "release-react" command must be executed in a React Native project folder.');
        }
        if (!entryFile) {
            entryFile = "index.".concat(platform, ".js");
            if (fileDoesNotExistOrIsDirectory(entryFile)) {
                entryFile = 'index.js';
            }
            if (fileDoesNotExistOrIsDirectory(entryFile)) {
                throw new Error("Entry file \"index.".concat(platform, ".js\" or \"index.js\" does not exist."));
            }
        }
        else {
            if (fileDoesNotExistOrIsDirectory(entryFile)) {
                throw new Error("Entry file \"".concat(entryFile, "\" does not exist."));
            }
        }
        if (command.appStoreVersion) {
            throwForInvalidSemverRange(command.appStoreVersion);
        }
        var appVersionPromise = command.appStoreVersion
            ? Promise.resolve(command.appStoreVersion)
            : (0, react_native_utils_1.getReactNativeProjectAppVersion)(command, projectName);
        if (command.sourcemapOutputDir && command.sourcemapOutput) {
            interaction_1.out.text('\n"sourcemap-output-dir" argument will be ignored as "sourcemap-output" argument is provided.\n');
        }
        if ((command.outputDir || command.sourcemapOutputDir) && !command.sourcemapOutput) {
            var sourcemapDir = command.sourcemapOutputDir || releaseCommand.package;
            command.sourcemapOutput = path_1.default.join(sourcemapDir, bundleName + '.map');
        }
        return appVersionPromise;
    })
        .then(function (appVersion) {
        releaseCommand.appStoreVersion = appVersion;
        return (0, exports.createEmptyTempReleaseFolder)(outputFolder);
    })
        // This is needed to clear the react native bundler cache:
        // https://github.com/facebook/react-native/issues/4289
        .then(function () { return deleteFolder("".concat(os_1.default.tmpdir(), "/react-*")); })
        .then(function () {
        return (0, react_native_utils_1.runReactNativeBundleCommand)(bundleName, command.development || false, entryFile, outputFolder, platform, command.sourcemapOutput, command.config, command.extraBundlerOptions);
    })
        .then(function () {
        if (platform === 'android') {
            return (0, react_native_utils_1.getHermesEnabled)(command.gradleFile).then(function (isHermesEnabled) {
                if (isHermesEnabled) {
                    return (0, react_native_utils_1.runHermesEmitBinaryCommand)(bundleName, outputFolder, command.sourcemapOutput, command.extraHermesFlags);
                }
            });
        }
        else if (platform === 'ios' || platform === 'harmony') {
            return (0, react_native_utils_1.getiOSHermesEnabled)(platform, command.podFile).then(function (isHermesEnabled) {
                if (isHermesEnabled) {
                    return (0, react_native_utils_1.runHermesEmitBinaryCommand)(bundleName, outputFolder, command.sourcemapOutput, command.extraHermesFlags);
                }
            });
        }
    })
        .then(function () {
        interaction_1.out.text(chalk_1.default.cyan('\nReleasing update contents to CodePush:\n'));
        return (0, exports.release)(releaseCommand);
    })
        .then(function () {
        if (!command.outputDir) {
            deleteFolder(outputFolder);
        }
    })
        .catch(function (err) {
        deleteFolder(outputFolder);
        throw err;
    }));
};
exports.releaseReact = releaseReact;
function validateDeployment(appName, deploymentName) {
    return exports.sdk.getDeployment(appName, deploymentName).catch(function (err) {
        // If we get an error that the deployment doesn't exist (but not the app doesn't exist), then tack on a more descriptive error message telling the user what to do
        if (err.statusCode === AccountManager.ERROR_NOT_FOUND &&
            err.message.indexOf('Deployment') !== -1) {
            err.message =
                err.message +
                    '\nUse "code-push deployment list" to view any existing deployments and "code-push deployment add" to add deployment(s) to the app.';
        }
        throw err;
    });
}
function rollback(command) {
    return (0, exports.confirm)().then(function (wasConfirmed) {
        if (!wasConfirmed) {
            interaction_1.out.text('Rollback cancelled.');
            return;
        }
        return exports.sdk
            .rollback(command.appName, command.deploymentName, command.targetRelease || undefined)
            .then(function () {
            interaction_1.out.text('Successfully performed a rollback on the "' +
                command.deploymentName +
                '" deployment of the "' +
                command.appName +
                '" app.');
        });
    });
}
function requestAccessKey() {
    return new Promise(function (resolve) {
        prompt.message = '';
        prompt.delimiter = '';
        prompt.start();
        prompt.get({
            properties: {
                response: {
                    description: chalk_1.default.cyan('Enter your token from the browser: '),
                },
            },
        }, function (err, result) {
            if (err) {
                resolve(null);
            }
            else {
                resolve(result.response.trim());
            }
        });
    });
}
function serializeConnectionInfo(accessKey, preserveAccessKeyOnLogout, customServerUrl, proxy, noProxy) {
    var connectionInfo = {
        accessKey: accessKey,
        preserveAccessKeyOnLogout: preserveAccessKeyOnLogout,
        proxy: proxy,
        noProxy: noProxy,
    };
    if (customServerUrl) {
        connectionInfo.customServerUrl = customServerUrl;
    }
    var json = JSON.stringify(connectionInfo);
    fs_1.default.writeFileSync(configFilePath, json, { encoding: 'utf8' });
    interaction_1.out.text("\r\nSuccessfully logged-in. Your session file was written to ".concat(chalk_1.default.cyan(configFilePath), ". You can run the ").concat(chalk_1.default.cyan('code-push logout'), " command at any time to delete this file and terminate your session.\r\n"));
}
function releaseErrorHandler(error, command) {
    if (command.noDuplicateReleaseError &&
        error.statusCode === AccountManager.ERROR_CONFLICT) {
        console.warn(chalk_1.default.yellow('[Warning] ' + error.message));
    }
    else {
        throw error;
    }
}
function throwForInvalidEmail(email) {
    if (!email_validator_1.default.validate(email)) {
        throw new Error('"' + email + '" is an invalid e-mail address.');
    }
}
function throwForInvalidSemverRange(semverRange) {
    // if (!isValidRange(semverRange)) {
    //     throw new Error(
    //         'Please use a semver-compliant target binary version range, for example "1.0.0", "*" or "^1.2.3".',
    //     );
    // }
}
function throwForInvalidOutputFormat(format) {
    switch (format) {
        case 'json':
        case 'table':
            break;
        default:
            throw new Error('Invalid format:  ' + format + '.');
    }
}
function whoami(command) {
    return exports.sdk.getAccountInfo().then(function (account) {
        var accountInfo = "".concat(account.email);
        var connectionInfo = deserializeConnectionInfo();
        if (connectionInfo.noProxy || connectionInfo.proxy) {
            interaction_1.out.text(chalk_1.default.green('Account: ') + accountInfo);
            var proxyInfo = chalk_1.default.green('Proxy: ') +
                (connectionInfo.noProxy ? 'Ignored' : connectionInfo.proxy);
            interaction_1.out.text(proxyInfo);
        }
        else {
            interaction_1.out.text(accountInfo);
        }
    });
}
function getProxy(proxy, noProxy) {
    if (noProxy)
        return null;
    if (!proxy)
        return (process.env.HTTPS_PROXY ||
            process.env.https_proxy ||
            process.env.HTTP_PROXY ||
            process.env.http_proxy);
    else
        return proxy;
}
function isCommandOptionSpecified(option) {
    return option !== undefined && option !== null;
}
function getSdk(accessKey, headers, customServerUrl, proxy) {
    var sdk = new AccountManager(accessKey, CLI_HEADERS, customServerUrl, proxy);
    /*
     * If the server returns `Unauthorized`, it must be due to an invalid
     * (or expired) access key. For convenience, we patch every SDK call
     * to delete the cached connection so the user can simply
     * login again instead of having to log out first.
     */
    Object.getOwnPropertyNames(AccountManager.prototype).forEach(function (functionName) {
        if (typeof sdk[functionName] === 'function') {
            var originalFunction = sdk[functionName];
            sdk[functionName] = function () {
                var maybePromise = originalFunction.apply(sdk, arguments);
                if (maybePromise && maybePromise.then !== undefined) {
                    maybePromise = maybePromise.catch(function (error) {
                        if (error.statusCode &&
                            error.statusCode === AccountManager.ERROR_UNAUTHORIZED) {
                            deleteConnectionInfoCache(/* printMessage */ false);
                        }
                        throw error;
                    });
                }
                return maybePromise;
            };
        }
    });
    return sdk;
}

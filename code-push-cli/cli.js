#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var command_parser_1 = require("./command-parser");
var command_executor_1 = require("./command-executor");
var chalk_1 = __importDefault(require("chalk"));
function run() {
    if (!command_parser_1.command) {
        (0, command_parser_1.showHelp)(/*showRootDescription*/ false);
        return;
    }
    (0, command_executor_1.execute)(command_parser_1.command).catch(function (error) {
        console.error(chalk_1.default.red('[Error]  ' + error.message));
        process.exit(1);
    });
}
run();

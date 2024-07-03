"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommandOutputTableOptions = exports.table = exports.text = void 0;
// Functions to support outputting stuff to the user
var io_options_1 = require("./io-options");
var Table = require('cli-table3');
function text() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i];
    }
    console.assert(!(0, io_options_1.formatIsCsv)(), "this function doesn't support CSV mode");
    var converter;
    var data;
    if (args.length === 1) {
        converter = null;
        data = args[0];
    }
    else {
        converter = args[0], data = args[1];
    }
    if ((0, io_options_1.formatIsJson)()) {
        if (converter) {
            console.log(JSON.stringify(data));
        }
    }
    else {
        converter = converter || (function (s) { return s; });
        console.log(converter(data));
    }
}
exports.text = text;
//
// Output tabular data.
// By default, does a simple default table using cli-table3.
// If you want to, you can pass in explicit table initialization
// options. See https://github.com/cli-table/cli-table3 for docs
// on the module.
//
function table(options, data) {
    console.assert(!(0, io_options_1.formatIsCsv)(), "this function doesn't support CSV mode");
    if (!data) {
        data = options;
        options = undefined;
    }
    if (!(0, io_options_1.formatIsJson)()) {
        var cliTable_1 = new Table(options);
        data.forEach(function (item) { return cliTable_1.push(item); });
        console.log(cliTable_1.toString());
    }
    else {
        console.log(JSON.stringify(data));
    }
}
exports.table = table;
// Formatting helper for cli-table3 - default command output table style
function getCommandOutputTableOptions(header) {
    return {
        head: header,
        style: {
            head: [],
        },
    };
}
exports.getCommandOutputTableOptions = getCommandOutputTableOptions;

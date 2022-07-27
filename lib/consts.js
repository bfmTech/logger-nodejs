"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Separator = exports.Level = exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType["console"] = "console";
    LogType["file"] = "file";
    LogType["http"] = "http";
})(LogType = exports.LogType || (exports.LogType = {}));
var Level;
(function (Level) {
    Level["debug"] = "debug";
    Level["info"] = "info";
    Level["warn"] = "warn";
    Level["error"] = "error";
    Level["access"] = "access";
})(Level = exports.Level || (exports.Level = {}));
exports.Separator = ' \t ';

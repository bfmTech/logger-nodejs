"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transport = void 0;
class Transport {
    constructor() { }
    // 日志格式化
    format(log) {
        return `[${log.logTime}] [${log.level}] [${log.appName}] [${log.stack}] ${log.message}`;
    }
}
exports.Transport = Transport;

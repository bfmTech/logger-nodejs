"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const common_1 = require("./common");
const consts_1 = require("./consts");
const transports_1 = require("./transports");
class Logger {
    constructor(appName, logType) {
        this.appName = appName;
        switch (logType) {
            case consts_1.LogType.console:
                this.transport = new transports_1.ConsoleTransport();
                break;
            case consts_1.LogType.file:
                this.transport = new transports_1.FileTransport(this.appName);
                break;
            case consts_1.LogType.http:
                this.transport = new transports_1.HttpTransport();
                break;
            default:
                this.transport = new transports_1.ConsoleTransport();
                break;
        }
    }
    debug(...message) {
        this._log(consts_1.Level.debug, message);
    }
    info(...message) {
        this._log(consts_1.Level.info, message);
    }
    warn(...message) {
        this._log(consts_1.Level.warn, message);
    }
    error(message) {
        let msg = [];
        if (message.valueOf == Error) {
            msg.push(message.message);
            if (message.stack)
                msg.push(message.stack);
        }
        else {
            msg.push(JSON.stringify(message));
        }
        this._log(consts_1.Level.error, msg);
    }
    access(method, status, beginTime, endTime, referer, httpHost, _interface, reqQuery, reqBody, resBody, clientIp, userAgent, headers) {
        let msg = [
            method,
            status,
            beginTime,
            endTime,
            referer,
            httpHost,
            _interface,
            reqQuery,
            reqBody,
            resBody,
            clientIp,
            userAgent,
            headers,
        ];
        this._log(consts_1.Level.access, msg);
    }
    getStack() {
        const obj = Object.create(null); // 初始化一个空对象
        Error.captureStackTrace(obj); // 捕捉堆栈并塞入obj.stack属性中
        return obj.stack.substring(common_1.common.indexOfNthStr(obj.stack, '(', 4) + 1, common_1.common.indexOfNthStr(obj.stack, ')', 4));
    }
    _log(level, message) {
        let stack = this.getStack();
        if (!stack)
            stack = ' ';
        var logInfo = {
            appName: this.appName,
            level: level,
            logTime: common_1.common.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.S'),
            stack: stack,
            message: message.join(consts_1.Separator),
        };
        this.transport.log(logInfo);
    }
    close() {
        this.transport.close();
    }
}
exports.Logger = Logger;

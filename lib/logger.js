"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const common_1 = require("./common");
const consts_1 = require("./consts");
const transports_1 = require("./transports");
class Logger {
    constructor(appName, logType, storingDays) {
        this.appName = appName;
        switch (logType) {
            case consts_1.LogType.console:
                this.transport = new transports_1.ConsoleTransport();
                break;
            case consts_1.LogType.file:
                this.transport = new transports_1.FileTransport(this.appName, storingDays);
                break;
            case consts_1.LogType.http:
                this.transport = new transports_1.HttpTransport();
                break;
            default:
                this.transport = new transports_1.ConsoleTransport();
                break;
        }
    }
    sql(...message) {
        if (message.length >= 2) {
            message = [message[0], message[1]];
        }
        this._log(consts_1.Level.info, message);
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
        if (message && message.message) {
            msg.push(message.message);
            // if (message.stack) msg.push(message.stack);
        }
        else {
            msg.push(JSON.stringify(message));
        }
        this._log(consts_1.Level.error, msg);
    }
    access(method, status, beginTime, endTime, referer, httpHost, _interface, reqQuery, reqBody, resBody, clientIp, userAgent, reqId, headers) {
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
            reqId,
            headers,
        ];
        this._log(consts_1.Level.access, msg);
    }
    getStack(level, skip) {
        const obj = Object.create(null); // 初始化一个空对象
        Error.captureStackTrace(obj); // 捕捉堆栈并塞入obj.stack属性中
        if (level == consts_1.Level.error) {
            return obj.stack;
        }
        else {
            return obj.stack.substring(common_1.common.indexOfNthStr(obj.stack, '(', skip) + 1, common_1.common.indexOfNthStr(obj.stack, ')', skip));
        }
    }
    _log(level, message) {
        let stack = this.getStack(level, 4);
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

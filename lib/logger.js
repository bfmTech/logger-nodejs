"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const common_1 = require("./common");
const consts_1 = require("./consts");
const transports_1 = require("./transports");
// 抓栈时只需要 2 帧：日志方法自身 + 业务调用方
const STACK_FRAMES = 2;
// 结构化堆栈钩子，直接拿 CallSite，跳过 V8 拼接堆栈字符串的开销
function captureCallSites(_error, callSites) {
    return callSites;
}
class Logger {
    constructor(appName, logType, storingDays, level) {
        this.appName = appName;
        // 级别阈值：构造参数优先，其次环境变量 LOGGER_LEVEL，默认输出全部日志
        this.levelPriority = (0, consts_1.resolveLevelPriority)(level || process.env.LOGGER_LEVEL);
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
        let stack = '';
        if (message && message.message) {
            msg.push(message.message);
            if (message.stack)
                stack = message.stack;
        }
        else {
            msg.push(this.stringify(message));
        }
        this._log(consts_1.Level.error, msg, stack);
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
    /**
     * 当前日志级别是否会被输出，业务侧可用于跳过昂贵的日志参数拼装
     */
    isLevelEnabled(level) {
        const priority = consts_1.LevelPriority[level];
        return priority === undefined || priority >= this.levelPriority;
    }
    // 只取业务调用方的 文件:行:列
    // 通过 prepareStackTrace 拿 CallSite 对象，避免 V8 把整个堆栈符号化成字符串后再做字符串查找
    getCallerPosition() {
        const originalPrepare = Error.prepareStackTrace;
        const originalLimit = Error.stackTraceLimit;
        let callSites;
        try {
            Error.prepareStackTrace = captureCallSites;
            Error.stackTraceLimit = STACK_FRAMES;
            const holder = {};
            // 以 _log 为界，隐藏 _log 及其之上的内部帧
            Error.captureStackTrace(holder, this._log);
            callSites = holder.stack;
        }
        catch (e) {
            return '';
        }
        finally {
            Error.prepareStackTrace = originalPrepare;
            Error.stackTraceLimit = originalLimit;
        }
        if (!callSites || !callSites.length || typeof callSites.length !== 'number') {
            return '';
        }
        // callSites[0] 是日志方法本身，[1] 才是业务调用方
        const site = callSites.length > 1 ? callSites[1] : callSites[0];
        if (!site || typeof site.getFileName !== 'function')
            return '';
        const fileName = site.getFileName();
        if (!fileName)
            return '';
        return fileName + ':' + site.getLineNumber() + ':' + site.getColumnNumber();
    }
    // error 级别保留完整堆栈
    getFullStack() {
        const holder = Object.create(null);
        Error.captureStackTrace(holder);
        return holder.stack || '';
    }
    stringify(message) {
        try {
            return JSON.stringify(message);
        }
        catch (e) {
            return String(message);
        }
    }
    _log(level, message, stack = '') {
        // 级别过滤放在最前面，被过滤的日志不抓堆栈、不做时间格式化
        const priority = consts_1.LevelPriority[level];
        if (priority !== undefined && priority < this.levelPriority)
            return;
        if (!stack) {
            stack =
                level == consts_1.Level.error ? this.getFullStack() : this.getCallerPosition();
        }
        if (!stack)
            stack = ' ';
        var logInfo = {
            appName: this.appName,
            level: level,
            logTime: common_1.common.now(),
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

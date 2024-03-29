"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTransport = void 0;
const transport_1 = require("./transport");
const fs_1 = require("fs");
const path_1 = require("path");
const os = __importStar(require("os"));
const common_1 = require("../common");
class FileTransport extends transport_1.Transport {
    constructor(appName, storingDays) {
        var _a;
        super();
        this.hostName = os.hostname();
        this.appName = appName;
        this.flushInterval = 1000;
        this.maxBufferSize = 1 * 1024 * 1024;
        this.maxBufferLength = 100;
        this.bufferMsg = [];
        this.bufferSize = 0;
        this.filePath = (_a = process.env.NODE_APP_DATA) !== null && _a !== void 0 ? _a : '/var/winnerlogs';
        // NODE_APP_DATA 环境变量存在时，storingDays才有效
        // storingDays未设置时，默认30天
        // storingDays=0时，永久存储
        if (process.env.NODE_APP_DATA) {
            this.storingDays = 30;
            if (storingDays)
                this.storingDays = storingDays;
        }
        else {
            this.storingDays = 0;
        }
        this.createWriteSteam();
        this.createInterval();
    }
    log(log) {
        let msg = super.format(log);
        this.bufferSize += Buffer.byteLength(msg, 'utf8');
        this.bufferMsg.push(msg);
        if (this.bufferSize >= this.maxBufferSize ||
            this.bufferMsg.length >= this.maxBufferLength) {
            this.flush();
        }
    }
    close() {
        var _a;
        if (this.bufferMsg && this.bufferMsg.length > 0) {
            this.flush();
        }
        (_a = this.loggerWriteStream) === null || _a === void 0 ? void 0 : _a.close();
    }
    flush() {
        var _a;
        if (this.bufferMsg.length > 0) {
            this.createWriteSteam();
            (_a = this.loggerWriteStream) === null || _a === void 0 ? void 0 : _a.write(this.bufferMsg.join('\n') + '\n');
            this.bufferMsg = [];
            this.bufferSize = 0;
        }
    }
    createWriteSteam() {
        const toDay = common_1.common.formatDate(new Date(), 'yyyy-MM-dd');
        if (!this.loggerWriteStream ||
            this.loggerWriteStream.path.indexOf(toDay) == -1) {
            if (this.loggerWriteStream) {
                this.loggerWriteStream.close();
            }
            const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
            if (!fs_1.existsSync(path_1.dirname(path))) {
                fs_1.mkdirSync(path_1.dirname(path), { recursive: true });
            }
            this.loggerWriteStream = fs_1.createWriteStream(path, { flags: 'a' });
            // 日志存储天数>0时，创建新一天日志文件时，删除过期的文件
            if (this.storingDays > 0) {
                let nowDate = new Date();
                let clearDay = common_1.common.formatDate(new Date(nowDate.setDate(nowDate.getDate() - this.storingDays - 1)), 'yyyy-MM-dd');
                const clearPath = `${this.filePath}/${this.appName}/${this.hostName}/logger-${clearDay}.log`;
                fs_1.unlink(clearPath, (err) => { });
            }
        }
    }
    createInterval() {
        return setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }
}
exports.FileTransport = FileTransport;

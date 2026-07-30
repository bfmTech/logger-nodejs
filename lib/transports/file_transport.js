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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTransport = void 0;
const transport_1 = require("./transport");
const fs_1 = require("fs");
const path_1 = require("path");
const os = __importStar(require("os"));
const common_1 = require("../common");
class FileTransport extends transport_1.Transport {
    constructor(appName, storingDays) {
        super();
        this.hostName = os.hostname();
        this.appName = appName;
        this.flushInterval = 1000;
        this.maxBufferSize = 1 * 1024 * 1024;
        this.maxBufferLength = 100;
        this.bufferMsg = [];
        this.bufferSize = 0;
        this.filePath = process.env.NODE_APP_DATA || '/var/winnerlogs';
        this.currentDay = '';
        this.closed = false;
        // 日志存储天数，三态：
        // 1. NODE_APP_DATA 未设置时，不做清理
        // 2. storingDays 未传时，默认保留 30 天
        // 3. storingDays=0 表示永久保留
        //    注意：1.2.0 之前传 0 会被当作未传处理，按 30 天清理
        if (process.env.NODE_APP_DATA) {
            this.storingDays = storingDays === undefined ? 30 : storingDays;
        }
        else {
            this.storingDays = 0;
        }
        this.createWriteSteam();
        this.interval = this.createInterval();
    }
    log(log) {
        const msg = super.format(log);
        // close() 之后没有定时器再来 flush，改为写穿，避免日志堆在 buffer 里丢掉
        if (this.closed) {
            this.writeThrough(msg);
            return;
        }
        this.bufferSize += Buffer.byteLength(msg, 'utf8');
        this.bufferMsg.push(msg);
        if (this.bufferSize >= this.maxBufferSize ||
            this.bufferMsg.length >= this.maxBufferLength) {
            this.flush();
        }
    }
    close() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
        if (this.bufferMsg.length > 0)
            this.flush();
        this.closed = true;
        const stream = this.loggerWriteStream;
        this.loggerWriteStream = undefined;
        this.currentDay = '';
        if (stream)
            stream.close();
    }
    // 仅用于 close() 之后的兜底写入，非热路径，同步写以保证不丢
    writeThrough(msg) {
        try {
            const toDay = common_1.common.day(Date.now());
            const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
            this.ensureDirectory((0, path_1.dirname)(path));
            (0, fs_1.appendFileSync)(path, msg + '\n');
        }
        catch (error) {
            process.stderr.write(msg + '\n');
        }
    }
    flush() {
        if (this.bufferMsg.length === 0)
            return;
        const chunk = this.bufferMsg.join('\n') + '\n';
        this.bufferMsg = [];
        this.bufferSize = 0;
        try {
            this.createWriteSteam();
            if (this.loggerWriteStream) {
                this.loggerWriteStream.write(chunk);
                return;
            }
        }
        catch (error) {
            // 目录创建失败（权限不足、只读挂载等）时异常不能逃出定时器回调，
            // 否则会以 uncaughtException 带崩宿主进程
        }
        // 流不可用：兜底输出到 stderr，避免这批日志静默丢失
        process.stderr.write(chunk);
    }
    createWriteSteam() {
        const toDay = common_1.common.day(Date.now());
        if (this.loggerWriteStream && this.currentDay === toDay)
            return;
        if (this.loggerWriteStream)
            this.loggerWriteStream.close();
        const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
        this.ensureDirectory((0, path_1.dirname)(path));
        const stream = (0, fs_1.createWriteStream)(path, { flags: 'a' });
        // 必须挂 error 监听。createWriteStream 是异步打开，若日志目录在此期间被移除
        // （日志轮转误删、k8s volume 卸载等），stream 会发出 error 事件；没有监听器时
        // Node 会抛未捕获异常，把宿主应用一起带崩。
        stream.on('error', (error) => {
            process.stderr.write('日志文件写入失败: ' + error.message + '\n');
            // 丢弃坏掉的流，下次 flush 会重建（含重建目录），实现自愈
            if (this.loggerWriteStream === stream) {
                this.loggerWriteStream = undefined;
                this.currentDay = '';
            }
        });
        this.loggerWriteStream = stream;
        this.currentDay = toDay;
        if (this.storingDays > 0) {
            const nowDate = new Date();
            const clearDay = common_1.common.day(new Date(nowDate.setDate(nowDate.getDate() - this.storingDays - 1)));
            const clearPath = `${this.filePath}/${this.appName}/${this.hostName}/logger-${clearDay}.log`;
            (0, fs_1.unlink)(clearPath, () => { });
        }
    }
    ensureDirectory(path) {
        if ((0, fs_1.existsSync)(path))
            return;
        const parent = (0, path_1.dirname)(path);
        if (parent !== path)
            this.ensureDirectory(parent);
        try {
            (0, fs_1.mkdirSync)(path);
        }
        catch (error) {
            if (!(0, fs_1.existsSync)(path))
                throw error;
        }
    }
    createInterval() {
        return setInterval(() => this.flush(), this.flushInterval);
    }
}
exports.FileTransport = FileTransport;

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
const log_buffer_1 = require("./log_buffer");
const fs_1 = require("fs");
const path_1 = require("path");
const os = __importStar(require("os"));
const common_1 = require("../common");
const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_LENGTH = 100;
const MAX_BUFFER_CHARS = (0, log_buffer_1.charsFromBytes)(1 * 1024 * 1024);
// 磁盘写入拥塞时最多积压的日志条数，超出后丢弃最旧的日志，避免内存无限增长
const MAX_CONGESTED_LENGTH = 10000;
class FileTransport extends transport_1.Transport {
    constructor(appName, storingDays) {
        var _a;
        super();
        this.hostName = os.hostname();
        this.appName = appName;
        this.congestedMsg = [];
        this.droppedCount = 0;
        this.writable = true;
        this.currentDay = '';
        this.currentPath = '';
        this.dayEndTime = 0;
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
        this.buffer = new log_buffer_1.LogBuffer((messages) => {
            this.writeBatch(messages);
        }, MAX_BUFFER_LENGTH, MAX_BUFFER_CHARS, FLUSH_INTERVAL);
        this.createWriteSteam();
        this.buffer.start();
        // 定时器已 unref，进程退出时同步补写残留日志，避免静默丢日志
        this.onExit = () => {
            this.flushSync();
        };
        process.once('exit', this.onExit);
    }
    log(log) {
        this.buffer.push(super.format(log));
    }
    close() {
        var _a;
        process.removeListener('exit', this.onExit);
        this.buffer.close();
        if (this.congestedMsg.length > 0 || this.droppedCount > 0) {
            this.flushSync();
        }
        (_a = this.loggerWriteStream) === null || _a === void 0 ? void 0 : _a.close();
    }
    writeBatch(messages) {
        // 跨天检查只做一次时间戳比较，不做日期格式化和路径字符串查找
        if (!this.loggerWriteStream || Date.now() >= this.dayEndTime) {
            this.createWriteSteam();
        }
        if (!this.loggerWriteStream)
            return;
        if (this.writable) {
            this.writeToStream(messages);
        }
        else {
            this.enqueueCongested(messages);
        }
    }
    writeToStream(messages) {
        const stream = this.loggerWriteStream;
        if (!stream)
            return;
        // write 返回 false 说明内核缓冲已满，等 drain 后再继续，期间日志进积压队列
        if (!stream.write(messages.join('\n') + '\n')) {
            this.writable = false;
            stream.once('drain', () => {
                this.writable = true;
                this.flushCongested();
            });
        }
    }
    enqueueCongested(messages) {
        for (let i = 0; i < messages.length; i++) {
            this.congestedMsg.push(messages[i]);
        }
        const overflow = this.congestedMsg.length - MAX_CONGESTED_LENGTH;
        if (overflow > 0) {
            this.congestedMsg.splice(0, overflow);
            this.droppedCount += overflow;
        }
    }
    flushCongested() {
        if (this.congestedMsg.length === 0 && this.droppedCount === 0)
            return;
        const messages = this.congestedMsg;
        this.congestedMsg = [];
        if (this.droppedCount > 0) {
            messages.unshift(`[logger] 日志写入拥塞，已丢弃 ${this.droppedCount} 条日志`);
            this.droppedCount = 0;
        }
        if (this.writable) {
            this.writeToStream(messages);
        }
        else {
            this.enqueueCongested(messages);
        }
    }
    // exit 事件里 WriteStream 的异步写入不会再被执行，用同步追加兜底
    flushSync() {
        const messages = this.congestedMsg.concat(this.buffer.take());
        this.congestedMsg = [];
        if (this.droppedCount > 0) {
            messages.unshift(`[logger] 日志写入拥塞，已丢弃 ${this.droppedCount} 条日志`);
            this.droppedCount = 0;
        }
        if (messages.length === 0 || !this.currentPath)
            return;
        try {
            (0, fs_1.appendFileSync)(this.currentPath, messages.join('\n') + '\n');
        }
        catch (e) {
            // 退出阶段写失败无法再补救，直接忽略
        }
    }
    createWriteSteam() {
        const now = Date.now();
        const toDay = common_1.common.day(now);
        this.dayEndTime = common_1.common.dayEndTime(now);
        if (this.loggerWriteStream && this.currentDay == toDay)
            return;
        if (this.loggerWriteStream) {
            this.loggerWriteStream.close();
        }
        const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
        this.mkdirp((0, path_1.dirname)(path));
        this.loggerWriteStream = (0, fs_1.createWriteStream)(path, { flags: 'a' });
        this.writable = true;
        this.currentDay = toDay;
        this.currentPath = path;
        // 日志存储天数>0时，创建新一天日志文件时，删除过期的文件
        if (this.storingDays > 0) {
            const nowDate = new Date(now);
            const clearDay = common_1.common.day(new Date(nowDate.setDate(nowDate.getDate() - this.storingDays - 1)));
            const clearPath = `${this.filePath}/${this.appName}/${this.hostName}/logger-${clearDay}.log`;
            (0, fs_1.unlink)(clearPath, (err) => { });
        }
    }
    // 逐级创建目录
    // mkdirSync 的 recursive 选项要求 node >= 10.12.0，这里手动实现以兼容 8.12.0
    mkdirp(dir) {
        if ((0, fs_1.existsSync)(dir))
            return;
        const pending = [];
        let current = dir;
        while (!(0, fs_1.existsSync)(current)) {
            pending.push(current);
            const parent = (0, path_1.dirname)(current);
            if (parent == current)
                break;
            current = parent;
        }
        for (let i = pending.length - 1; i >= 0; i--) {
            try {
                (0, fs_1.mkdirSync)(pending[i]);
            }
            catch (e) {
                if (!e || e.code !== 'EEXIST')
                    throw e;
            }
        }
    }
}
exports.FileTransport = FileTransport;

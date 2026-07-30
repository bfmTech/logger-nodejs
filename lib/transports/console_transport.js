"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTransport = void 0;
const consts_1 = require("../consts");
const transport_1 = require("./transport");
class ConsoleTransport extends transport_1.Transport {
    constructor() {
        super();
        this.flushInterval = 1000;
        this.maxBufferSize = 1 * 1024 * 1024;
        this.maxBufferLength = 100;
        this.bufferMsg = [];
        this.bufferSize = 0;
        this.closed = false;
        this.interval = setInterval(() => this.flush(), this.flushInterval);
        // 原先每条日志一次 write 系统调用，且没有定时器。加缓冲后必须 unref，
        // 否则原本能自然退出的短生命周期脚本会被这个定时器一直吊住。
        if (typeof this.interval.unref === 'function')
            this.interval.unref();
        // unref 的定时器不阻止进程退出，所以退出前要主动把 buffer 倒干净
        this.onBeforeExit = () => this.flush();
        process.on('beforeExit', this.onBeforeExit);
    }
    // 打印console日志
    log(log) {
        const msg = super.format(log) + '\n';
        // error 量小但价值高：立即写出，避免进程异常终止时丢失。
        // 写 stderr 前先 flush stdout，保证「错误之前的普通日志已经先出去」的因果顺序。
        if (log.level == consts_1.Level.error) {
            this.flush();
            process.stderr.write(msg);
            return;
        }
        // close() 之后没有定时器再来 flush，改为直接写出
        if (this.closed) {
            process.stdout.write(msg);
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
        process.removeListener('beforeExit', this.onBeforeExit);
        this.flush();
        this.closed = true;
    }
    flush() {
        if (this.bufferMsg.length === 0)
            return;
        // 每条 msg 结尾已带 '\n'，直接拼接
        const chunk = this.bufferMsg.join('');
        this.bufferMsg = [];
        this.bufferSize = 0;
        process.stdout.write(chunk);
    }
}
exports.ConsoleTransport = ConsoleTransport;

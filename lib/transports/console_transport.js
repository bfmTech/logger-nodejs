"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTransport = void 0;
const consts_1 = require("../consts");
const transport_1 = require("./transport");
const log_buffer_1 = require("./log_buffer");
const fs_1 = require("fs");
const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_LENGTH = 100;
const MAX_BUFFER_CHARS = (0, log_buffer_1.charsFromBytes)(1 * 1024 * 1024);
const STDOUT_FD = 1;
const STDERR_FD = 2;
class ConsoleTransport extends transport_1.Transport {
    constructor() {
        super();
        // 批量写，把每条日志一次 write 系统调用降为每批一次
        this.stdoutBuffer = new log_buffer_1.LogBuffer((messages) => {
            process.stdout.write(messages.join('\n') + '\n');
        }, MAX_BUFFER_LENGTH, MAX_BUFFER_CHARS, FLUSH_INTERVAL);
        this.stderrBuffer = new log_buffer_1.LogBuffer((messages) => {
            process.stderr.write(messages.join('\n') + '\n');
        }, MAX_BUFFER_LENGTH, MAX_BUFFER_CHARS, FLUSH_INTERVAL);
        this.stdoutBuffer.start();
        this.stderrBuffer.start();
        // 进程退出时同步输出残留日志，console 模式仍然不需要显式调用 close()
        this.onExit = () => {
            this.flushSync();
        };
        process.once('exit', this.onExit);
    }
    // 打印console日志
    log(log) {
        const msg = super.format(log);
        // 切换输出流前先把另一个流的积压送走，保证两个流之间的相对顺序
        if (log.level == consts_1.Level.error) {
            this.stdoutBuffer.flush();
            this.stderrBuffer.push(msg);
        }
        else {
            this.stderrBuffer.flush();
            this.stdoutBuffer.push(msg);
        }
    }
    close() {
        process.removeListener('exit', this.onExit);
        this.stdoutBuffer.close();
        this.stderrBuffer.close();
    }
    // exit 事件里异步写入不会再被执行，必须用同步写
    flushSync() {
        this.writeFdSync(STDOUT_FD, this.stdoutBuffer.take());
        this.writeFdSync(STDERR_FD, this.stderrBuffer.take());
    }
    writeFdSync(fd, messages) {
        if (messages.length === 0)
            return;
        try {
            (0, fs_1.writeSync)(fd, messages.join('\n') + '\n');
        }
        catch (e) {
            // 退出阶段写失败无法再补救，直接忽略
        }
    }
}
exports.ConsoleTransport = ConsoleTransport;

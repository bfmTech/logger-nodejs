"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTransport = void 0;
const transport_1 = require("./transport");
const log_buffer_1 = require("./log_buffer");
const fs_1 = require("fs");
const ALY = require('aliyun-sdk');
const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_LENGTH = 200;
const MAX_BUFFER_CHARS = (0, log_buffer_1.charsFromBytes)(2 * 1024 * 1024);
const MAX_RETRY = 3;
const RETRY_INTERVAL = 1000;
const STDOUT_FD = 1;
class HttpTransport extends transport_1.Transport {
    constructor() {
        super();
        let endpoint = process.env.LOGGER_ALIYUN_ENDPOINT;
        let projectName = process.env.LOGGER_ALIYUN_PROJECTNAME;
        let logStoreName = process.env.LOGGER_ALIYUN_LOGSTORENAME;
        const accessKeyId = process.env.LOGGER_ALIYUN_ACCESSKEYID;
        const accessKeySecret = process.env.LOGGER_ALIYUN_ACCESSKEYSECRET;
        if (!(accessKeyId && accessKeySecret)) {
            throw new Error('LOGGER_ALIYUN 环境变量配置不正确');
        }
        endpoint = endpoint !== null && endpoint !== void 0 ? endpoint : 'http://cn-hangzhou.log.aliyuncs.com';
        projectName = projectName !== null && projectName !== void 0 ? projectName : 'k8s-log-custom-zwdfroh2';
        logStoreName = logStoreName !== null && logStoreName !== void 0 ? logStoreName : 'config-operation-log';
        this.projectName = projectName;
        this.logStoreName = logStoreName;
        this.sls = new ALY.SLS({
            accessKeyId: accessKeyId,
            secretAccessKey: accessKeySecret,
            endpoint: endpoint,
            // 这是 sls sdk 目前支持最新的 api 版本, 不需要修改
            apiVersion: '2015-06-01',
            //以下是可选配置
            httpOptions: {
                timeout: 2000, //2sec, 默认没有timeout
            },
        });
        this.buffer = new log_buffer_1.LogBuffer((messages) => {
            this.putLogs(messages);
        }, MAX_BUFFER_LENGTH, MAX_BUFFER_CHARS, FLUSH_INTERVAL);
        this.buffer.start();
        // 定时器已 unref，进程退出时残留日志改为同步打印到控制台，避免静默丢失
        this.onExit = () => {
            this.flushSync();
        };
        process.once('exit', this.onExit);
    }
    log(log) {
        this.buffer.push(super.format(log));
    }
    close() {
        process.removeListener('exit', this.onExit);
        this.buffer.close();
    }
    flushSync() {
        const messages = this.buffer.take();
        if (messages.length === 0)
            return;
        try {
            (0, fs_1.writeSync)(STDOUT_FD, messages.join('\n') + '\n');
        }
        catch (e) {
            // 退出阶段写失败无法再补救，直接忽略
        }
    }
    retryPutLogs(msg, tryNum) {
        if (tryNum >= MAX_RETRY) {
            // 上传失败兜底打印到控制台，一次系统调用输出整批
            process.stdout.write(msg.join('\n') + '\n');
        }
        else {
            setTimeout(() => {
                tryNum++;
                this.putLogs(msg, tryNum);
            }, RETRY_INTERVAL);
        }
    }
    putLogs(msg, tryNum = 0) {
        // 时间戳整批算一次，不必每条日志都 new Date()
        const time = Math.floor(Date.now() / 1000);
        const logs = new Array(msg.length);
        for (let i = 0; i < msg.length; i++) {
            logs[i] = {
                time: time,
                contents: [
                    {
                        key: 'content',
                        value: msg[i],
                    },
                ],
            };
        }
        const that = this;
        this.sls.putLogs({
            projectName: this.projectName,
            logStoreName: this.logStoreName,
            logGroup: { logs: logs },
        }, function (err) {
            if (err) {
                that.retryPutLogs(msg, tryNum);
                if (tryNum >= MAX_RETRY) {
                    console.log('日志上传失败，已打印至控制台。Error:', err.message);
                }
            }
        });
    }
}
exports.HttpTransport = HttpTransport;

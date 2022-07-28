"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpTransport = void 0;
const transport_1 = require("./transport");
const ALY = require('aliyun-sdk');
class HttpTransport extends transport_1.Transport {
    constructor() {
        super();
        this.flushInterval = 3000;
        this.maxBufferSize = 5 * 1024 * 1024;
        this.maxBufferLength = 200;
        this.bufferMsg = [];
        this.bufferSize = 0;
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
        this.createInterval();
    }
    log(log) {
        const msg = super.format(log);
        this.bufferSize += Buffer.byteLength(msg, 'utf8');
        this.bufferMsg.push(msg);
        if (this.bufferSize >= this.maxBufferSize ||
            this.bufferMsg.length >= this.maxBufferLength) {
            this.flush();
        }
    }
    close() {
        if (this.bufferMsg && this.bufferMsg.length > 0) {
            this.flush();
        }
    }
    flush() {
        if (this.bufferMsg.length > 0) {
            this.putLogs(this.bufferMsg);
            this.bufferMsg = [];
            this.bufferSize = 0;
        }
    }
    retryPutLogs(msg, tryNum) {
        if (tryNum >= 3) {
            msg.forEach((e) => {
                process.stdout.write(e + '\n');
            });
        }
        else {
            setTimeout(() => {
                tryNum++;
                this.putLogs(msg, tryNum);
            }, 1000);
        }
    }
    putLogs(msg, tryNum = 0) {
        let logs = [];
        for (let i = 0; i < msg.length; i++) {
            logs.push({
                time: Math.floor(new Date().getTime() / 1000),
                contents: [
                    {
                        key: 'content',
                        value: msg[i],
                    },
                ],
            });
        }
        var logGroup = {
            logs: logs,
        };
        let that = this;
        this.sls.putLogs({
            projectName: this.projectName,
            logStoreName: this.logStoreName,
            logGroup: logGroup,
        }, function (err) {
            if (err) {
                that.retryPutLogs(msg, tryNum);
            }
        });
    }
    createInterval() {
        return setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }
}
exports.HttpTransport = HttpTransport;

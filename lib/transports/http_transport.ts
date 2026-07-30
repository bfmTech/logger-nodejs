import { LogInfo } from '../consts';
import { Transport } from './transport';

export class HttpTransport extends Transport {
  private flushInterval: number;
  private maxBufferSize: number;
  private maxBufferLength: number;
  private bufferMsg: string[];
  private bufferSize: number;
  private sls: any;
  private projectName: string;
  private logStoreName: string;
  private interval?: NodeJS.Timer;
  private maxPendingRetries: number;
  private pendingRetries: number;
  private closed: boolean;

  constructor() {
    super();
    this.flushInterval = 1000;
    this.maxBufferSize = 2 * 1024 * 1024;
    this.maxBufferLength = 200;
    this.bufferMsg = [];
    this.bufferSize = 0;
    this.maxPendingRetries = 5;
    this.pendingRetries = 0;
    this.closed = false;

    let endpoint = process.env.LOGGER_ALIYUN_ENDPOINT;
    let projectName = process.env.LOGGER_ALIYUN_PROJECTNAME;
    let logStoreName = process.env.LOGGER_ALIYUN_LOGSTORENAME;
    const accessKeyId = process.env.LOGGER_ALIYUN_ACCESSKEYID;
    const accessKeySecret = process.env.LOGGER_ALIYUN_ACCESSKEYSECRET;

    if (!(accessKeyId && accessKeySecret)) {
      throw new Error('LOGGER_ALIYUN 环境变量配置不正确');
    }
    endpoint = endpoint || 'http://cn-hangzhou.log.aliyuncs.com';
    projectName = projectName || 'k8s-log-custom-zwdfroh2';
    logStoreName = logStoreName || 'config-operation-log';
    this.projectName = projectName;
    this.logStoreName = logStoreName;

    const ALY = require('aliyun-sdk');
    this.sls = new ALY.SLS({
      accessKeyId: accessKeyId,
      secretAccessKey: accessKeySecret,
      endpoint: endpoint,
      apiVersion: '2015-06-01',
      httpOptions: { timeout: 2000 },
    });
    this.interval = this.createInterval();
  }

  log(log: LogInfo) {
    const msg = super.format(log);

    // close() 之后没有定时器再来 flush，且异步上传未必赶得上进程退出，直接落控制台
    if (this.closed) {
      process.stdout.write(msg + '\n');
      return;
    }

    this.bufferSize += Buffer.byteLength(msg, 'utf8');
    this.bufferMsg.push(msg);
    if (
      this.bufferSize >= this.maxBufferSize ||
      this.bufferMsg.length >= this.maxBufferLength
    ) {
      this.flush();
    }
  }

  close() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    if (this.bufferMsg.length > 0) this.flush();
    this.closed = true;
  }

  private flush() {
    if (this.bufferMsg.length === 0) return;
    const msg = this.bufferMsg;
    this.bufferMsg = [];
    this.bufferSize = 0;
    // logs 只在这里构建一次，重试复用同一份，
    // 顺带让重试保留日志原始时间戳而不是重试时刻
    this.putLogs(msg, this.buildLogs(msg));
  }

  private buildLogs(msg: string[]) {
    const logs = [];
    const time = Math.floor(Date.now() / 1000);
    for (let i = 0; i < msg.length; i++) {
      logs.push({
        time: time,
        contents: [{ key: 'content', value: msg[i] }],
      });
    }
    return logs;
  }

  private dumpToConsole(msg: string[]) {
    for (let i = 0; i < msg.length; i++) {
      process.stdout.write(msg[i] + '\n');
    }
  }

  private retryPutLogs(msg: string[], logs: any[], tryNum: number) {
    if (tryNum >= 3) {
      this.dumpToConsole(msg);
      return;
    }

    // SLS 持续不可用时，每批最多持有 2MB 且会不断叠加，这里给在途重试封顶
    if (this.pendingRetries >= this.maxPendingRetries) {
      console.log(
        '日志上传重试队列已满(' +
          this.maxPendingRetries +
          ')，本批直接打印至控制台。'
      );
      this.dumpToConsole(msg);
      return;
    }

    this.pendingRetries++;
    const timer = setTimeout(() => {
      this.pendingRetries--;
      this.putLogs(msg, logs, tryNum + 1);
    }, 1000);
    if (typeof timer.unref === 'function') timer.unref();
  }

  private putLogs(msg: string[], logs: any[], tryNum: number = 0) {
    const that = this;
    this.sls.putLogs(
      {
        projectName: this.projectName,
        logStoreName: this.logStoreName,
        logGroup: { logs: logs },
      },
      function (err: any) {
        if (err) {
          if (tryNum >= 3) {
            console.log('日志上传失败，已打印至控制台。Error:', err.message);
          }
          that.retryPutLogs(msg, logs, tryNum);
        }
      }
    );
  }

  private createInterval() {
    return setInterval(() => this.flush(), this.flushInterval);
  }
}

import { LogInfo } from '../consts';
import { Transport } from './transport';
import { LogBuffer, charsFromBytes } from './log_buffer';
import { writeSync } from 'fs';
const ALY = require('aliyun-sdk');

const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_LENGTH = 200;
const MAX_BUFFER_CHARS = charsFromBytes(2 * 1024 * 1024);
const MAX_RETRY = 3;
const RETRY_INTERVAL = 1000;

const STDOUT_FD = 1;

export class HttpTransport extends Transport {
  private buffer: LogBuffer;
  private sls: any;
  private projectName: string;
  private logStoreName: string;
  private onExit: () => void;
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
    endpoint = endpoint ?? 'http://cn-hangzhou.log.aliyuncs.com';
    projectName = projectName ?? 'k8s-log-custom-zwdfroh2';
    logStoreName = logStoreName ?? 'config-operation-log';

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

    this.buffer = new LogBuffer(
      (messages) => {
        this.putLogs(messages);
      },
      MAX_BUFFER_LENGTH,
      MAX_BUFFER_CHARS,
      FLUSH_INTERVAL
    );
    this.buffer.start();

    // 定时器已 unref，进程退出时残留日志改为同步打印到控制台，避免静默丢失
    this.onExit = () => {
      this.flushSync();
    };
    process.once('exit', this.onExit);
  }

  log(log: LogInfo) {
    this.buffer.push(super.format(log));
  }

  close() {
    process.removeListener('exit', this.onExit);
    this.buffer.close();
  }

  private flushSync() {
    const messages = this.buffer.take();
    if (messages.length === 0) return;

    try {
      writeSync(STDOUT_FD, messages.join('\n') + '\n');
    } catch (e) {
      // 退出阶段写失败无法再补救，直接忽略
    }
  }

  private retryPutLogs(msg: string[], tryNum: number) {
    if (tryNum >= MAX_RETRY) {
      // 上传失败兜底打印到控制台，一次系统调用输出整批
      process.stdout.write(msg.join('\n') + '\n');
    } else {
      setTimeout(() => {
        tryNum++;
        this.putLogs(msg, tryNum);
      }, RETRY_INTERVAL);
    }
  }

  private putLogs(msg: string[], tryNum: number = 0) {
    // 时间戳整批算一次，不必每条日志都 new Date()
    const time = Math.floor(Date.now() / 1000);
    const logs: any[] = new Array(msg.length);
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

    this.sls.putLogs(
      {
        projectName: this.projectName,
        logStoreName: this.logStoreName,
        logGroup: { logs: logs },
      },
      function (err: any) {
        if (err) {
          that.retryPutLogs(msg, tryNum);
          if (tryNum >= MAX_RETRY) {
            console.log('日志上传失败，已打印至控制台。Error:', err.message);
          }
        }
      }
    );
  }
}

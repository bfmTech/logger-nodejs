import { LogInfo } from '../consts';
import { Transport } from './transport';
const ALY = require('aliyun-sdk');

export class HttpTransport extends Transport {
  private flushInterval: number;
  private maxBufferLength: number;
  private bufferMsg: string[];
  private bufferSize: number;
  private sls: any;
  private projectName: string;
  private logStoreName: string;
  constructor() {
    super();

    this.flushInterval = 3000;
    this.maxBufferLength = 8 * 1024 * 1024;
    this.bufferMsg = [];
    this.bufferSize = 0;

    const endpoint = process.env.LOGGER_ALIYUN_ENDPOINT;
    const projectName = process.env.LOGGER_ALIYUN_PROJECTNAME;
    const logStoreName = process.env.LOGGER_ALIYUN_LOGSTORENAME;
    const accessKeyId = process.env.LOGGER_ALIYUN_ACCESSKEYID;
    const accessKeySecret = process.env.LOGGER_ALIYUN_ACCESSKEYSECRET;

    if (
      !(
        endpoint &&
        projectName &&
        logStoreName &&
        accessKeyId &&
        accessKeySecret
      )
    ) {
      throw new Error('LOGGER_ALIYUN 环境变量配置不正确');
    }

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

  log(log: LogInfo) {
    const msg = super.format(log);

    this.bufferSize += Buffer.byteLength(msg, 'utf8');
    this.bufferMsg.push(msg);
    if (this.bufferSize >= this.maxBufferLength) {
      this.flush();
    }
  }

  close() {
    if (this.bufferMsg && this.bufferMsg.length > 0) {
      this.flush();
    }
  }

  private flush() {
    if (this.bufferMsg.length > 0) {
      this.putLogs(this.bufferMsg);

      this.bufferMsg = [];
      this.bufferSize = 0;
    }
  }

  private putLogs(msg: string[]) {
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

    this.sls.putLogs(
      {
        projectName: this.projectName,
        logStoreName: this.logStoreName,
        logGroup: logGroup,
      },
      function (err: any) {
        if (err) {
          console.log('error:', err);
        }
      }
    );
  }

  private createInterval() {
    return setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}
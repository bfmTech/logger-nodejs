import { LogInfo } from '../consts';
import { Transport } from './transport';
import { createWriteStream, existsSync, WriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as os from 'os';
import { common } from '../common';

export class FileTransport extends Transport {
  private flushInterval: number;
  private maxBufferSize: number;
  private maxBufferLength: number;
  private bufferMsg: string[];
  private bufferSize: number;
  private filePath: string;
  private appName: string;
  private hostName: string;
  private loggerWriteStream?: WriteStream;
  constructor(appName: string) {
    super();

    this.hostName = os.hostname();
    this.appName = appName;
    this.flushInterval = 3000;
    this.maxBufferSize = 1 * 1024 * 1024;
    this.maxBufferLength = 100;
    this.bufferMsg = [];
    this.bufferSize = 0;
    this.filePath = process.env.NODE_APP_DATA ?? '/var/winnerlogs';

    this.createWriteSteam();
    this.createInterval();
  }

  log(log: LogInfo) {
    let msg = super.format(log);

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
    if (this.bufferMsg && this.bufferMsg.length > 0) {
      this.flush();
    }

    this.loggerWriteStream?.close();
  }

  private flush() {
    if (this.bufferMsg.length > 0) {
      this.createWriteSteam();
      this.loggerWriteStream?.write(this.bufferMsg.join('\n') + '\n');
      this.bufferMsg = [];
      this.bufferSize = 0;
    }
  }

  private createWriteSteam() {
    const toDay = common.formatDate(new Date(), 'yyyy-MM-dd');
    if (
      !this.loggerWriteStream ||
      this.loggerWriteStream.path.indexOf(toDay) == -1
    ) {
      if (this.loggerWriteStream) {
        this.loggerWriteStream.close();
      }

      const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
      if (!existsSync(dirname(path)))
        mkdirSync(dirname(path), { recursive: true });
      this.loggerWriteStream = createWriteStream(path, { flags: 'a' });
    }
  }

  private createInterval() {
    return setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}

import { LogInfo } from '../consts';
import { Transport } from './transport';
import { LogBuffer, charsFromBytes } from './log_buffer';
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  WriteStream,
  mkdirSync,
  unlink,
} from 'fs';
import { dirname } from 'path';
import * as os from 'os';
import { common } from '../common';

const FLUSH_INTERVAL = 1000;
const MAX_BUFFER_LENGTH = 100;
const MAX_BUFFER_CHARS = charsFromBytes(1 * 1024 * 1024);
// 磁盘写入拥塞时最多积压的日志条数，超出后丢弃最旧的日志，避免内存无限增长
const MAX_CONGESTED_LENGTH = 10000;

export class FileTransport extends Transport {
  private buffer: LogBuffer;
  private congestedMsg: string[];
  private droppedCount: number;
  private writable: boolean;
  private filePath: string;
  private appName: string;
  private hostName: string;
  private loggerWriteStream?: WriteStream;
  private storingDays: number;
  private currentDay: string;
  private currentPath: string;
  private dayEndTime: number;
  private onExit: () => void;
  constructor(appName: string, storingDays?: number) {
    super();

    this.hostName = os.hostname();
    this.appName = appName;
    this.congestedMsg = [];
    this.droppedCount = 0;
    this.writable = true;
    this.currentDay = '';
    this.currentPath = '';
    this.dayEndTime = 0;
    this.filePath = process.env.NODE_APP_DATA ?? '/var/winnerlogs';

    // NODE_APP_DATA 环境变量存在时，storingDays才有效
    // storingDays未设置时，默认30天
    // storingDays=0时，永久存储
    if (process.env.NODE_APP_DATA) {
      this.storingDays = 30;
      if (storingDays) this.storingDays = storingDays;
    } else {
      this.storingDays = 0;
    }

    this.buffer = new LogBuffer(
      (messages) => {
        this.writeBatch(messages);
      },
      MAX_BUFFER_LENGTH,
      MAX_BUFFER_CHARS,
      FLUSH_INTERVAL
    );

    this.createWriteSteam();
    this.buffer.start();

    // 定时器已 unref，进程退出时同步补写残留日志，避免静默丢日志
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

    if (this.congestedMsg.length > 0 || this.droppedCount > 0) {
      this.flushSync();
    }

    this.loggerWriteStream?.close();
  }

  private writeBatch(messages: string[]) {
    // 跨天检查只做一次时间戳比较，不做日期格式化和路径字符串查找
    if (!this.loggerWriteStream || Date.now() >= this.dayEndTime) {
      this.createWriteSteam();
    }

    if (!this.loggerWriteStream) return;

    if (this.writable) {
      this.writeToStream(messages);
    } else {
      this.enqueueCongested(messages);
    }
  }

  private writeToStream(messages: string[]) {
    const stream = this.loggerWriteStream;
    if (!stream) return;

    // write 返回 false 说明内核缓冲已满，等 drain 后再继续，期间日志进积压队列
    if (!stream.write(messages.join('\n') + '\n')) {
      this.writable = false;
      stream.once('drain', () => {
        this.writable = true;
        this.flushCongested();
      });
    }
  }

  private enqueueCongested(messages: string[]) {
    for (let i = 0; i < messages.length; i++) {
      this.congestedMsg.push(messages[i]);
    }

    const overflow = this.congestedMsg.length - MAX_CONGESTED_LENGTH;
    if (overflow > 0) {
      this.congestedMsg.splice(0, overflow);
      this.droppedCount += overflow;
    }
  }

  private flushCongested() {
    if (this.congestedMsg.length === 0 && this.droppedCount === 0) return;

    const messages = this.congestedMsg;
    this.congestedMsg = [];

    if (this.droppedCount > 0) {
      messages.unshift(
        `[logger] 日志写入拥塞，已丢弃 ${this.droppedCount} 条日志`
      );
      this.droppedCount = 0;
    }

    if (this.writable) {
      this.writeToStream(messages);
    } else {
      this.enqueueCongested(messages);
    }
  }

  // exit 事件里 WriteStream 的异步写入不会再被执行，用同步追加兜底
  private flushSync() {
    const messages = this.congestedMsg.concat(this.buffer.take());
    this.congestedMsg = [];

    if (this.droppedCount > 0) {
      messages.unshift(
        `[logger] 日志写入拥塞，已丢弃 ${this.droppedCount} 条日志`
      );
      this.droppedCount = 0;
    }

    if (messages.length === 0 || !this.currentPath) return;

    try {
      appendFileSync(this.currentPath, messages.join('\n') + '\n');
    } catch (e) {
      // 退出阶段写失败无法再补救，直接忽略
    }
  }

  private createWriteSteam() {
    const now = Date.now();
    const toDay = common.day(now);
    this.dayEndTime = common.dayEndTime(now);

    if (this.loggerWriteStream && this.currentDay == toDay) return;

    if (this.loggerWriteStream) {
      this.loggerWriteStream.close();
    }

    const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
    this.mkdirp(dirname(path));

    this.loggerWriteStream = createWriteStream(path, { flags: 'a' });
    this.writable = true;
    this.currentDay = toDay;
    this.currentPath = path;

    // 日志存储天数>0时，创建新一天日志文件时，删除过期的文件
    if (this.storingDays > 0) {
      const nowDate = new Date(now);
      const clearDay = common.day(
        new Date(nowDate.setDate(nowDate.getDate() - this.storingDays - 1))
      );

      const clearPath = `${this.filePath}/${this.appName}/${this.hostName}/logger-${clearDay}.log`;
      unlink(clearPath, (err) => {});
    }
  }

  // 逐级创建目录
  // mkdirSync 的 recursive 选项要求 node >= 10.12.0，这里手动实现以兼容 8.12.0
  private mkdirp(dir: string) {
    if (existsSync(dir)) return;

    const pending: string[] = [];
    let current = dir;
    while (!existsSync(current)) {
      pending.push(current);
      const parent = dirname(current);
      if (parent == current) break;
      current = parent;
    }

    for (let i = pending.length - 1; i >= 0; i--) {
      try {
        mkdirSync(pending[i]);
      } catch (e) {
        if (!e || (e as any).code !== 'EEXIST') throw e;
      }
    }
  }
}

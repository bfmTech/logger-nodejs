import { common } from './common';
import { LogType, Level, LogInfo, Separator } from './consts';
import { ConsoleTransport, FileTransport, HttpTransport } from './transports';

export class Logger {
  private appName: string;
  private transport: ConsoleTransport | FileTransport | HttpTransport;
  constructor(appName: string, logType: LogType, storingDays?: number) {
    this.appName = appName;

    switch (logType) {
      case LogType.console:
        this.transport = new ConsoleTransport();
        break;
      case LogType.file:
        this.transport = new FileTransport(this.appName, storingDays);
        break;
      case LogType.http:
        this.transport = new HttpTransport();
        break;

      default:
        this.transport = new ConsoleTransport();
        break;
    }
  }

  public sql(...message: string[]) {
    if (message.length >= 2) {
      message = [message[0], message[1]];
    }
    this._log(Level.info, message);
  }

  public debug(...message: string[]) {
    this._log(Level.debug, message);
  }

  public info(...message: string[]) {
    this._log(Level.info, message);
  }

  public warn(...message: string[]) {
    this._log(Level.warn, message);
  }

  public error(message: Error) {
    let msg: string[] = [];
    if (message && message.message) {
      msg.push(message.message);
      // if (message.stack) msg.push(message.stack);
    } else {
      msg.push(JSON.stringify(message));
    }

    this._log(Level.error, msg);
  }

  public access(
    method: string,
    status: number,
    beginTime: number,
    endTime: number,
    referer: string,
    httpHost: string,
    _interface: string,
    reqQuery: string,
    reqBody: string,
    resBody: string,
    clientIp: string,
    userAgent: string,
    reqId: string,
    headers: string
  ) {
    let msg: any = [
      method,
      status,
      beginTime,
      endTime,
      referer,
      httpHost,
      _interface,
      reqQuery,
      reqBody,
      resBody,
      clientIp,
      userAgent,
      reqId,
      headers,
    ];
    this._log(Level.access, msg);
  }

  private getStack(level: Level, skip: number) {
    const obj = Object.create(null); // 初始化一个空对象
    Error.captureStackTrace(obj); // 捕捉堆栈并塞入obj.stack属性中
    if (level == Level.error) {
      return obj.stack;
    } else {
      return obj.stack.substring(
        common.indexOfNthStr(obj.stack, '(', skip) + 1,
        common.indexOfNthStr(obj.stack, ')', skip)
      );
    }
  }
  private _log(level: Level, message: string[]) {
    let stack = this.getStack(level, 4);
    if (!stack) stack = ' ';

    var logInfo: LogInfo = {
      appName: this.appName,
      level: level,
      logTime: common.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.S'),
      stack: stack,
      message: message.join(Separator),
    };

    this.transport.log(logInfo);
  }

  public close() {
    this.transport.close();
  }
}

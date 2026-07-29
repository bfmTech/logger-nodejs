import { common } from './common';
import {
  LogType,
  Level,
  LogInfo,
  Separator,
  LevelPriority,
  resolveLevelPriority,
} from './consts';
import { ConsoleTransport, FileTransport, HttpTransport } from './transports';

// 抓栈时只需要 2 帧：日志方法自身 + 业务调用方
const STACK_FRAMES = 2;
// 结构化堆栈钩子，直接拿 CallSite，跳过 V8 拼接堆栈字符串的开销
function captureCallSites(_error: Error, callSites: any[]) {
  return callSites;
}

export class Logger {
  private appName: string;
  private transport: ConsoleTransport | FileTransport | HttpTransport;
  private levelPriority: number;
  constructor(
    appName: string,
    logType: LogType,
    storingDays?: number,
    level?: Level | string
  ) {
    this.appName = appName;

    // 级别阈值：构造参数优先，其次环境变量 LOGGER_LEVEL，默认输出全部日志
    this.levelPriority = resolveLevelPriority(
      level || process.env.LOGGER_LEVEL
    );

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
    let stack = '';
    if (message && message.message) {
      msg.push(message.message);
      if (message.stack) stack = message.stack;
    } else {
      msg.push(this.stringify(message));
    }

    this._log(Level.error, msg, stack);
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

  /**
   * 当前日志级别是否会被输出，业务侧可用于跳过昂贵的日志参数拼装
   */
  public isLevelEnabled(level: Level): boolean {
    const priority = LevelPriority[level];
    return priority === undefined || priority >= this.levelPriority;
  }

  // 只取业务调用方的 文件:行:列
  // 通过 prepareStackTrace 拿 CallSite 对象，避免 V8 把整个堆栈符号化成字符串后再做字符串查找
  private getCallerPosition(): string {
    const originalPrepare = (Error as any).prepareStackTrace;
    const originalLimit = Error.stackTraceLimit;
    let callSites: any;

    try {
      (Error as any).prepareStackTrace = captureCallSites;
      Error.stackTraceLimit = STACK_FRAMES;

      const holder: any = {};
      // 以 _log 为界，隐藏 _log 及其之上的内部帧
      Error.captureStackTrace(holder, this._log);
      callSites = holder.stack;
    } catch (e) {
      return '';
    } finally {
      (Error as any).prepareStackTrace = originalPrepare;
      Error.stackTraceLimit = originalLimit;
    }

    if (!callSites || !callSites.length || typeof callSites.length !== 'number') {
      return '';
    }

    // callSites[0] 是日志方法本身，[1] 才是业务调用方
    const site = callSites.length > 1 ? callSites[1] : callSites[0];
    if (!site || typeof site.getFileName !== 'function') return '';

    const fileName = site.getFileName();
    if (!fileName) return '';

    return fileName + ':' + site.getLineNumber() + ':' + site.getColumnNumber();
  }

  // error 级别保留完整堆栈
  private getFullStack(): string {
    const holder: any = Object.create(null);
    Error.captureStackTrace(holder);
    return holder.stack || '';
  }

  private stringify(message: any): string {
    try {
      return JSON.stringify(message);
    } catch (e) {
      return String(message);
    }
  }

  private _log(level: Level, message: any[], stack: string = '') {
    // 级别过滤放在最前面，被过滤的日志不抓堆栈、不做时间格式化
    const priority = LevelPriority[level];
    if (priority !== undefined && priority < this.levelPriority) return;

    if (!stack) {
      stack =
        level == Level.error ? this.getFullStack() : this.getCallerPosition();
    }
    if (!stack) stack = ' ';

    var logInfo: LogInfo = {
      appName: this.appName,
      level: level,
      logTime: common.now(),
      stack: stack,
      message: message.join(Separator),
    };

    this.transport.log(logInfo);
  }

  public close() {
    this.transport.close();
  }
}

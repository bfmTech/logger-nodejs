import { LogInfo } from '../consts';

export class Transport {
  constructor() {}

  // 日志格式化
  format(log: LogInfo) {
    return `[${log.logTime}] [${log.level}] [${log.appName}] [${log.stack}] ${log.message}`;
  }
}

export enum LogType {
  console = 'console',
  file = 'file',
  http = 'http',
}

export enum Level {
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
  access = 'access',
}

export interface LogInfo {
  appName: string; // 应用名
  level: Level; // 级别
  logTime: string; // 时间
  message: string; // 内容
  stack: string; // 堆栈
}

export const Separator = ' \t ';

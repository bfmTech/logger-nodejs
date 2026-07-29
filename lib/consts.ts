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

// 级别优先级，用于日志级别过滤（低于阈值的日志直接丢弃，不抓堆栈、不格式化）
// access 恒为最高优先级，永不被过滤
export const LevelPriority: { [level: string]: number } = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  access: 1000,
};

// 未配置级别时的默认阈值：debug，即输出全部日志，与历史行为一致
const DefaultPriority = LevelPriority[Level.debug];
// 阈值上限，避免把 error 也过滤掉
const MaxPriority = LevelPriority[Level.error];

/**
 * 解析日志级别阈值。传入非法值或未传时返回默认阈值(debug)
 */
export function resolveLevelPriority(level?: Level | string): number {
  if (!level) return DefaultPriority;

  const priority = LevelPriority[String(level).toLowerCase()];
  if (priority === undefined) return DefaultPriority;

  return priority > MaxPriority ? MaxPriority : priority;
}

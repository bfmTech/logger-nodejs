// 日志内部使用的两种固定格式，走无正则的快速路径
const FMT_TIMESTAMP = 'yyyy-MM-dd HH:mm:ss.S';
const FMT_DAY = 'yyyy-MM-dd';

// 通用格式化用的正则，模块级预编译，避免每次调用都 new RegExp
const YEAR_TOKEN = /(y+)/;
const DATE_TOKENS: Array<{ re: RegExp; get: (date: Date) => number }> = [
  { re: /(M+)/, get: (date) => date.getMonth() + 1 },
  { re: /(d+)/, get: (date) => date.getDate() },
  { re: /(H+)/, get: (date) => date.getHours() },
  { re: /(m+)/, get: (date) => date.getMinutes() },
  { re: /(s+)/, get: (date) => date.getSeconds() },
  { re: /(S+)/, get: (date) => date.getMilliseconds() },
];

function pad2(num: number): string {
  return num < 10 ? '0' + num : '' + num;
}

class Common {
  // yyyy-MM-dd HH:mm:ss. 前缀缓存，按秒复用
  private tsSecond: number = NaN;
  private tsPrefix: string = '';
  // yyyy-MM-dd 缓存，按本地自然日复用
  private dayStart: number = 0;
  private dayEnd: number = 0;
  private dayStr: string = '';

  /**
   * 当前时间的 yyyy-MM-dd HH:mm:ss.S
   * 同一秒内只做一次日期分解，毫秒部分直接拼接
   */
  public now(): string {
    return this.timestamp(Date.now());
  }

  /**
   * 指定时间的 yyyy-MM-dd HH:mm:ss.S
   */
  public timestamp(time: number | Date): string {
    const t = typeof time === 'number' ? time : time.getTime();
    const second = Math.floor(t / 1000);

    if (second !== this.tsSecond) {
      const date = new Date(t);
      this.tsSecond = second;
      this.tsPrefix =
        date.getFullYear() +
        '-' +
        pad2(date.getMonth() + 1) +
        '-' +
        pad2(date.getDate()) +
        ' ' +
        pad2(date.getHours()) +
        ':' +
        pad2(date.getMinutes()) +
        ':' +
        pad2(date.getSeconds()) +
        '.';
    }

    // 毫秒不补零，与历史格式保持一致
    return this.tsPrefix + (t - second * 1000);
  }

  /**
   * 指定时间所在本地自然日的 yyyy-MM-dd
   */
  public day(time: number | Date): string {
    this.ensureDayCache(typeof time === 'number' ? time : time.getTime());
    return this.dayStr;
  }

  /**
   * 指定时间所在本地自然日的结束时间戳（次日 00:00:00.000），用于跨天判断
   */
  public dayEndTime(time: number | Date): number {
    this.ensureDayCache(typeof time === 'number' ? time : time.getTime());
    return this.dayEnd;
  }

  public formatDate(date: Date, fmt: string) {
    if (fmt === FMT_TIMESTAMP) return this.timestamp(date);
    if (fmt === FMT_DAY) return this.day(date);
    return this.formatDateSlow(date, fmt);
  }

  public indexOfNthStr(sourceStr: string, str: string, n: number) {
    let index = -1;
    while (n--) {
      index = sourceStr.indexOf(str, index + 1);
      if (index == -1) {
        break;
      }
    }
    return index;
  }

  private ensureDayCache(t: number) {
    if (t >= this.dayStart && t < this.dayEnd) return;

    const date = new Date(t);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // 用本地时间构造日界，自动适配时区与夏令时
    this.dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
    this.dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();
    this.dayStr = year + '-' + pad2(month + 1) + '-' + pad2(day);
  }

  // 任意格式的通用实现，行为与历史版本一致
  private formatDateSlow(date: Date, fmt: string) {
    let match = YEAR_TOKEN.exec(fmt);
    if (match) {
      fmt = fmt.replace(
        match[1],
        (date.getFullYear() + '').substr(4 - match[1].length)
      );
    }

    for (let i = 0; i < DATE_TOKENS.length; i++) {
      const token = DATE_TOKENS[i];
      match = token.re.exec(fmt);
      if (!match) continue;

      const value = token.get(date);
      fmt = fmt.replace(
        match[1],
        match[1].length == 1
          ? String(value)
          : ('00' + value).substr(String(value).length)
      );
    }

    return fmt;
  }
}

export let common = new Common();

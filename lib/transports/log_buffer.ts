/**
 * UTF-8 字节数上限折算成 JS 字符数上限
 * BMP 字符最多 3 字节；4 字节字符在 JS 里占 2 个 char，折算后仍不超过 3 字节/char
 * 用字符数做阈值判断可以省掉每条日志一次 Buffer.byteLength 的全串扫描
 */
export function charsFromBytes(bytes: number): number {
  return Math.floor(bytes / 3);
}

/**
 * 日志缓冲：按条数、字符数、定时三个条件触发批量输出
 */
export class LogBuffer {
  private messages: string[];
  private chars: number;
  private timer: any;
  private onFlush: (messages: string[]) => void;
  private maxLength: number;
  private maxChars: number;
  private interval: number;

  constructor(
    onFlush: (messages: string[]) => void,
    maxLength: number,
    maxChars: number,
    interval: number
  ) {
    this.onFlush = onFlush;
    this.maxLength = maxLength;
    this.maxChars = maxChars;
    this.interval = interval;
    this.messages = [];
    this.chars = 0;
    this.timer = undefined;
  }

  public get length(): number {
    return this.messages.length;
  }

  public push(msg: string) {
    // 单条超长日志先把已积压的内容送走，保证每批体积可控
    if (this.messages.length > 0 && msg.length >= this.maxChars) {
      this.flush();
    }

    this.messages.push(msg);
    this.chars += msg.length;

    if (this.messages.length >= this.maxLength || this.chars >= this.maxChars) {
      this.flush();
    }
  }

  public flush() {
    if (this.messages.length === 0) return;
    this.onFlush(this.take());
  }

  /**
   * 取出并清空缓冲内容，交给调用方自行输出
   */
  public take(): string[] {
    const messages = this.messages;
    this.messages = [];
    this.chars = 0;
    return messages;
  }

  public start() {
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.flush();
    }, this.interval);

    // 定时器不应阻止进程退出
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  public close() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.flush();
  }
}

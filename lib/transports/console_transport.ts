import { Level, LogInfo } from '../consts';
import { Transport } from './transport';

export class ConsoleTransport extends Transport {
  constructor() {
    super();
  }

  // 打印console日志
  log(log: LogInfo) {
    let msg = super.format(log) + '\n';

    if (log.level == Level.error) {
      process.stderr.write(msg);
    } else {
      process.stdout.write(msg);
    }
  }

  close() {}
}

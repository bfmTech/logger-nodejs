"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleTransport = void 0;
const consts_1 = require("../consts");
const transport_1 = require("./transport");
class ConsoleTransport extends transport_1.Transport {
    constructor() {
        super();
    }
    // 打印console日志
    log(log) {
        let msg = super.format(log) + '\n';
        if (log.level == consts_1.Level.error) {
            process.stderr.write(msg);
        }
        else {
            process.stdout.write(msg);
        }
    }
    close() { }
}
exports.ConsoleTransport = ConsoleTransport;

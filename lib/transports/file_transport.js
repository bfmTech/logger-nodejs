"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTransport = void 0;
const transport_1 = require("./transport");
const fs_1 = require("fs");
const path_1 = require("path");
const os = __importStar(require("os"));
const common_1 = require("../common");
class FileTransport extends transport_1.Transport {
    constructor(appName) {
        super();
        this.hostName = os.hostname();
        this.appName = appName;
        this.flushInterval = 3000;
        this.maxBufferLength = 1 * 1024 * 1024;
        this.bufferMsg = [];
        this.bufferSize = 0;
        this.filePath = '/var/winnerlogs';
        this.createWriteSteam();
        this.createInterval();
    }
    log(log) {
        let msg = super.format(log);
        this.bufferSize += Buffer.byteLength(msg, 'utf8');
        this.bufferMsg.push(msg);
        if (this.bufferSize >= this.maxBufferLength) {
            this.flush();
        }
    }
    close() {
        var _a;
        if (this.bufferMsg && this.bufferMsg.length > 0) {
            this.flush();
        }
        (_a = this.loggerWriteStream) === null || _a === void 0 ? void 0 : _a.close();
    }
    flush() {
        var _a;
        if (this.bufferMsg.length > 0) {
            this.createWriteSteam();
            (_a = this.loggerWriteStream) === null || _a === void 0 ? void 0 : _a.write(this.bufferMsg.join('\n') + '\n');
            this.bufferMsg = [];
            this.bufferSize = 0;
        }
    }
    createWriteSteam() {
        const toDay = common_1.common.formatDate(new Date(), 'yyyy-MM-dd');
        if (!this.loggerWriteStream ||
            this.loggerWriteStream.path.indexOf(toDay) == -1) {
            if (this.loggerWriteStream) {
                this.loggerWriteStream.close();
            }
            const path = `${this.filePath}/${this.appName}/${this.hostName}/logger-${toDay}.log`;
            if (!fs_1.existsSync(path_1.dirname(path)))
                fs_1.mkdirSync(path_1.dirname(path), { recursive: true });
            this.loggerWriteStream = fs_1.createWriteStream(path, { flags: 'a' });
        }
    }
    createInterval() {
        return setInterval(() => {
            this.flush();
        }, this.flushInterval);
    }
}
exports.FileTransport = FileTransport;

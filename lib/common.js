"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.common = void 0;
const FMT_TIMESTAMP = 'yyyy-MM-dd HH:mm:ss.S';
const FMT_DAY = 'yyyy-MM-dd';
const YEAR_TOKEN = /(y+)/;
const DATE_TOKENS = [
    { re: /(M+)/, get: (date) => date.getMonth() + 1 },
    { re: /(d+)/, get: (date) => date.getDate() },
    { re: /(H+)/, get: (date) => date.getHours() },
    { re: /(m+)/, get: (date) => date.getMinutes() },
    { re: /(s+)/, get: (date) => date.getSeconds() },
    { re: /(S+)/, get: (date) => date.getMilliseconds() },
];
function pad2(num) {
    return num < 10 ? '0' + num : '' + num;
}
class Common {
    constructor() {
        this.timestampSecond = NaN;
        this.timestampPrefix = '';
        this.dayStart = 0;
        this.dayEnd = 0;
        this.dayText = '';
    }
    now() {
        return this.timestamp(Date.now());
    }
    timestamp(time) {
        const value = typeof time === 'number' ? time : time.getTime();
        const second = Math.floor(value / 1000);
        if (second !== this.timestampSecond) {
            const date = new Date(value);
            this.timestampSecond = second;
            this.timestampPrefix =
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
        return this.timestampPrefix + (value - second * 1000);
    }
    day(time) {
        this.ensureDayCache(typeof time === 'number' ? time : time.getTime());
        return this.dayText;
    }
    formatDate(date, fmt) {
        if (fmt === FMT_TIMESTAMP)
            return this.timestamp(date);
        if (fmt === FMT_DAY)
            return this.day(date);
        let match = YEAR_TOKEN.exec(fmt);
        if (match) {
            fmt = fmt.replace(match[1], (date.getFullYear() + '').substr(4 - match[1].length));
        }
        for (let i = 0; i < DATE_TOKENS.length; i++) {
            const token = DATE_TOKENS[i];
            match = token.re.exec(fmt);
            if (!match)
                continue;
            const value = token.get(date);
            fmt = fmt.replace(match[1], match[1].length == 1
                ? String(value)
                : ('00' + value).substr(String(value).length));
        }
        return fmt;
    }
    indexOfNthStr(sourceStr, str, n) {
        let index = -1;
        while (n--) {
            index = sourceStr.indexOf(str, index + 1);
            if (index == -1)
                break;
        }
        return index;
    }
    ensureDayCache(time) {
        if (time >= this.dayStart && time < this.dayEnd)
            return;
        const date = new Date(time);
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        this.dayStart = new Date(year, month, day, 0, 0, 0, 0).getTime();
        this.dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0).getTime();
        this.dayText = year + '-' + pad2(month + 1) + '-' + pad2(day);
    }
}
exports.common = new Common();

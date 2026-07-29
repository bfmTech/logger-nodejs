"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLevelPriority = exports.LevelPriority = exports.Separator = exports.Level = exports.LogType = void 0;
var LogType;
(function (LogType) {
    LogType["console"] = "console";
    LogType["file"] = "file";
    LogType["http"] = "http";
})(LogType = exports.LogType || (exports.LogType = {}));
var Level;
(function (Level) {
    Level["debug"] = "debug";
    Level["info"] = "info";
    Level["warn"] = "warn";
    Level["error"] = "error";
    Level["access"] = "access";
})(Level = exports.Level || (exports.Level = {}));
exports.Separator = ' \t ';
// 级别优先级，用于日志级别过滤（低于阈值的日志直接丢弃，不抓堆栈、不格式化）
// access 恒为最高优先级，永不被过滤
exports.LevelPriority = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    access: 1000,
};
// 未配置级别时的默认阈值：debug，即输出全部日志，与历史行为一致
const DefaultPriority = exports.LevelPriority[Level.debug];
// 阈值上限，避免把 error 也过滤掉
const MaxPriority = exports.LevelPriority[Level.error];
/**
 * 解析日志级别阈值。传入非法值或未传时返回默认阈值(debug)
 */
function resolveLevelPriority(level) {
    if (!level)
        return DefaultPriority;
    const priority = exports.LevelPriority[String(level).toLowerCase()];
    if (priority === undefined)
        return DefaultPriority;
    return priority > MaxPriority ? MaxPriority : priority;
}
exports.resolveLevelPriority = resolveLevelPriority;

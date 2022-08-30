const { Logger, LogType } = require('../');

const appName = 'logger-test';

const logger = new Logger(appName, LogType.console);

module.exports = logger;

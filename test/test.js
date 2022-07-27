const { Logger, LogType } = require('../index');

let logger = new Logger('node-test', LogType.http);

logger.info('test');

// setInterval(() => {
//   logger.info('这是一条消息', '消息的第二段');
// }, 30);

logger.access(
  'get',
  200,
  1657092964,
  1657092964,
  'http://xxx.test.com.cn',
  'xx.test.com.cn',
  '/api/v2/warning/list',
  'page=1&limit=10',
  '',
  '4e8eaca4d',
  '113.132.211.1',
  'Mozilla/5.0 (Linux; Android 9; COR-AL10 Build/HUAWEICOR-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.93 Mobile Safari/537.36;psbc',
  '334kj3k4j3k4j'
);

const logger = require('./logger');

logger.info('这是info消息1', '消息2', '消息3');

logger.error(Error('错误'));

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
  '{"code":0,"data": "","msg":"success"}',
  '113.132.211.1',
  'Mozilla/5.0 (Linux; Android 9; COR-AL10 Build/HUAWEICOR-AL10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/88.0.4324.93 Mobile Safari/537.36;psbc',
  '1a221f4943ac983760c5e240f4fa3a5a',
  'token:32323212995fd32'
);

setInterval(() => {
  logger.info('这是info消息1', '消息2', '消息3');
}, 5000);

// 退出时关闭logger
['SIGINT', 'SIGTERM'].forEach((signal) =>
  process.on(signal, () => {
    console.info(signal + ' signal received.');

    logger.close();

    setTimeout(() => {
      console.log('application exit');
      process.exit();
    }, 3000);
  })
);

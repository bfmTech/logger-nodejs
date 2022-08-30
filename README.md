# logger-nodejs

logger sdk nodejs 版本。将日志内容按照统一格式通过控制台、文件、http上传到阿里云sls，支持缓存上传。

## 快速开始

```javascript
// npm安装
npm i logger-nodejs --registry http://172.16.129.144:4873
```

logger.js

```javascript
const { Logger, LogType } = require('logger-nodejs');
const packageJson = require('../package.json');

// 应用名称（唯一）
const appName =
  packageJson.name && packageJson.name != '' ? packageJson.name : 'appName';

const logger = new Logger(appName, LogType.console);

// LogType.console // 控制台 (k8s容器平台使用(推荐))
// LogType.file    // 文件 (k8s容器平台使用)
// LogType.http    // http(需配置阿里云相关环境变量(联系架构部))

module.exports = logger;
```

app.js

```javascript
const logger = require('./logger'); // 引用 logger.js

// 根据业务场景，选择不同的方法(level)记录日志

logger.info('记录info日志', '支持多个参数', '可根据每个参数检索');
// error日志 钉钉会发送告警
logger.error(Error("出错了")); // 接收Error对象
logger.access(); // access日志，根据方法提示的参数传递

// 程序关闭或退出时执行，上传最后缓存中的日志，避免日志丢失
logger.close()；
```

## 详细说明

日志上传方式 LogType

|  LogType   | 使用环境  | 说明  |
|  ----  | ----  | ----  |
| console  | 容器平台(推荐) | 日志输出到控制台，Logtail采集 |
| file  | 容器平台 | 日志根据日期保存到指定目录，Logtail采集 |
| http  | 任意环境(需配置阿里云相关环境变量) | http上传日志到阿里sls |


日志类型 level 可在查询时筛选
```code
-level.debug    //支持多个参数，可根据每个参数检索
-level.info     //支持多个参数，可根据每个参数检索
-level.warn     //支持多个参数，可根据每个参数检索
-level.error    //只接受Error对象 （推送钉钉告警消息）
-level.access   //access日志，根据方法提示的参数传递
```

access日志 字段说明

|  字段   | 类型  | 说明  |
|  ----  | ----  | ----  |
| method  | string | 请求方法 |
| status  | number | HTTP请求状态 |
| beginTime  | number | 请求开始时间(秒时间戳) |
| endTime  | number | 请求结束时间(秒时间戳) |
| referer  | string | 请求来源 |
| httpHost  | string | 请求地址 |
| _interface  | string | 请求接口 |
| reqQuery  | string | 请求url参数 |
| reqBody  | string | 请求body参数 |
| resBody  | string | 请求返回参数 |
| clientIp  | string | 客户端IP |
| userAgent  | string | 用户终端浏览器等信息  |
| reqId  | string | header[X-Request-ID]请求id，用于链路跟踪 |
| headers  | string | 其他数据，比如：token |

## 注意
1、 `appName` 需唯一，且有意义，用于检索和报错时通知负责人。

2、`LogType`为`file`或`http`时，程序退出时必须调用close()，否则可能导致最后部分日志丢失。

3、`LogType`为`http`时，需要配置阿里云相关环境变量，请联系架构部。

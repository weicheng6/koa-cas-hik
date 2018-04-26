const configuration = require('./configure');
const fetch = require('node-fetch');
const authenticate = require('./authenticate');
const queryString = require('query-string');

module.exports = function(pgt, targetService, callback) {
  if (typeof callback !== 'function') {
    callback = function() {};
  }

  if (!targetService) {
    debug('targetService is required!');

    // 理论上不应该出现这种场景! 直接500
    return Promise.reject({
      status: 500,
      message: 'targetService is required'
    });
  } else if (!pgt) {
    // 可能是pgt过期了, 直接401
    return Promise.reject({
      status: 401,
      message: 'pgt is required'
    });
  }

  const options = configuration();

  const params = {};
  params.targetService = targetService;
  params.pgt = pgt;

  /**
   *  请求pt, 返回一个promise, 无法获取或者没pgt则返回401
   */
  // ticket复用，暂不提供实现
  // if (req.pt && req.pt[options.targetService]) {
  //   return next();
  // }

  const proxyPath = options.path + options.paths.proxy + '?' + queryString.stringify(params);

  debug('request pt', proxyPath);

  return fetch(proxyPath)
    .then(function(res) {
      if (res.status == 200) {
        return res.text();
      } else {
        const err = {
          status: res.status,
          message: 'query pt failed!'
        };
        return Promise.reject(err);
      }
    })
    .then(function(body) {
      let pt = '';
      if (/<cas:proxySuccess/.exec(body)) {
        if (/<cas:proxyTicket>(.*)<\/cas:proxyTicket>/.exec(body)) {
          pt = RegExp.$1;
        }
      }

      if (pt) {
        callback(null, pt);
        return pt;
      } else {

        debug('can\' get pt from XML.');

        return Promise.reject({
          status: 401,
          message: 'Not a valid CAS XML response.'
        });
      }
    })
    .catch(function(err) {
      if (err instanceof Error) debug(err.stack);
      callback(err);
      return Promise.reject(err);
    })
};


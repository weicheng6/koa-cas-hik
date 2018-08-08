const url = require('url');
const debug = require('debug')('koa-cas-hik');

const defaults = {
  path: '',
  ignore: [],
  ajaxHeader: 'X-Requested-With',
  ajaxRedirect: null,
  redirect: null,
  loginRedirect:null,
  paths: {
    validate: '',
    serviceValidate: '/cas/serviceValidate',
    proxy: '/cas/proxy',
    login: '/cas/login',
    logout: '/cas/logout',
    proxyCallback: ''
  },
  sessionKey: 'koa:sess',
  store: null,
  logout:{
      router : '/logout',
      redirect :  null
  }
};

module.exports = function(options) {
  if (!options) return JSON.parse(JSON.stringify(defaults));

  if (options.host && options.protocol) {
    debug('Setting CAS server path by host/protocal etc. is deprecated, use options.path instead!');
    options.path = url.format(options);
  }

  if (options.proxyCallback) {
    debug('options.proxyCallback is deprecated, use options.paths.proxyCallback instead!');
    options.paths.proxyCallback = options.proxyCallback;
  }

  if (options.pgtUrl) {
    debug('options.pgtUrl is deprecated, use options.paths.proxyCallback instead!');
    options.paths.proxyCallback = options.pgtUrl;
  }

  return Object.assign({}, defaults, options);
};

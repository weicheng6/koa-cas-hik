const origin = require('./util').origin;
const checkIgnoreRule = require('./util').checkIgnoreRule;
const queryString = require('query-string');
const debug = require('debug')('koa-cas-hik');
debug.log = console.log.bind(console);

module.exports = function(options) {
  return function(ctx, next) {
    if (options.ignore && options.ignore.length) {
      if (checkIgnoreRule(ctx, options.ignore, ctx.path)) return next();
    }

    if (ctx.session && ctx.session.st) {
      if ((options.paths.proxyCallback && ctx.session.pgt) || !options.paths.proxyCallback) {
        return next();
      } else {
        if (options.paths.proxyCallback && !ctx.session.pgt) {
          debug('Using proxy-mode CAS, but pgtId is not found in session.');
        }
      }
    } else {
      debug('Can not find st in session %o', ctx.session);
    }
    // 找不到session/st，跳到login

    // 先将之前原始路径存在session
    ctx.session.lastUrl = origin(ctx);

    const params = {};

    params.service = origin(ctx);

    if (options.params) {
      Object.assign(params, options.params);
    }

    if (options.ajaxHeader && ctx.get(options.ajaxHeader)) {
      debug('Need to redirect, but matched AJAX request, send 418');
      if(typeof options.ajaxRedirect === 'function') {
        return options.ajaxRedirect(ctx, next);
      }
      ctx.status = 418;
      return ctx.body = {
        message: 'Login status expired, need refresh path'
      };
    } else {
      if(typeof options.loginRedirect === 'function') {
        return options.loginRedirect(ctx, params, next);
      }
      let loginPath;
      if(ctx.headers['x-forwarded-proto']){
        loginPath = ctx.headers['x-forwarded-proto']+'://' + ctx.headers['host'] + options.paths.login + '?' + queryString.stringify(params);
      }else{
        loginPath = options.path + options.paths.login + '?' + queryString.stringify(params);
      }
      debug('redirect to login page %s', loginPath);
      ctx.response.redirect(loginPath, 302);
    }
  };
};

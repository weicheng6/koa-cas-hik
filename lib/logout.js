/**
 * 登出
 * @param options
 * @returns {Function}
 */
const debug = require('debug')('koa-cas-hik');
debug.log = console.log.bind(console);

module.exports = function(options) {
  return async function(ctx, next) {
    if (ctx.method !== 'GET' || ctx.url !== options.logout.router) {
      await next();
      return;
    }

    debug('Receive a logout request');

    if (ctx.session) {
      if(ctx.session.st){
        options.store.destroy(ctx.session.st);
      }

      ctx.session = null;
    }

    debug('logout');
    
    // Forget our own login session
    if (typeof options.logout.redirect === 'function') {
      return options.logout.redirect(ctx, next);
    }

    // Send the user to the official campus-wide logout URL
    return ctx.response.redirect(options.path + options.paths.logout + '?service=' + encodeURIComponent(ctx.headers.referer || ctx.origin));
  }
}
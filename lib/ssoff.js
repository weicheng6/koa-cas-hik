/**
 * 单点登出
 * @param options
 * @returns {Function}
 */
const debug = require('debug')('koa-cas-hik');
debug.log = console.log.bind(console);

module.exports = function(options) {
  return async function(ctx, next) {
    if (!options.store) throw new Error('no session store configured');
    ctx.ssoff = true;

    if (ctx.method !== 'POST' || ctx.get('content-type').toLowerCase().indexOf('multipart') !== -1 || !ctx.request.body.logoutRequest) {
      await next();
      return;
    }

    if (!/<samlp:SessionIndex>(.*)<\/samlp:SessionIndex>/.exec(ctx.request.body.logoutRequest)) {
      await next();
      return;
    }

    debug('CAS server request for logouting');
    const st = RegExp.$1;

    const result = await options.store.get(st);
    options.store.destroy(st);
    if (result && result.sid) options.store.destroy(result.sid);

    debug('logout');
    return ctx.status = 204;
  }
}

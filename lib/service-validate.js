/**
 * @File 验证ticket，拿ptgid，处理proxyCallback等操作
 *
 */

const checkIgnoreRule = require('./util').checkIgnoreRule;
const origin = require('./util').origin;
const parseUrl = require('url').parse;
const queryString = require('query-string');
const fetch = require('node-fetch');
const xml2js = require('xml2js').parseString;
const stripPrefix = require('xml2js/lib/processors').stripPrefix;
const debug = require('debug')('koa-cas-hik');
debug.log = console.log.bind(console);

module.exports = function(options) {
  const pgtCallbackUri = parseUrl(options.paths.proxyCallback || '');
  const pgtPathname = pgtCallbackUri.pathname;

  /**
   * 仅当/cas/proxyCallback 和/cas/validate 两个请求会被响应，/cas/validate必须带ticket，否则也会next
   * 其余都会next
   */
  return async function(ctx, next) {      
      if (!options.path) throw new Error('CAS server path is not specified.');
      // if (!options.servicePrefix) throw new Error('No servicePrefix specified.');
  
      // // 强制需要提供sessionStore的实现
      if (!options.store) throw new Error('Session store is required!');
  
      if (!ctx.session) {
        debug('service-validate, ctx.session is undefined!');
        ctx.status = 503;
        return ctx.body = {
          message: 'service-validate, ctx.session is undefined!'
        };
      }
  
      const url = parseUrl(ctx.url, true);
  
      if (options.ignore && options.ignore.length) {
        if (checkIgnoreRule(ctx, options.ignore, ctx.path)) {
          debug('Match ignore rule, jump through CAS authentication.');
          return next();
        }
      }
  
      const ticket = (url.query && url.query.ticket) ? url.query.ticket : null;
  
      const params = {};
      params.service = origin(ctx);//options.servicePrefix + options.paths.validate;
      params.ticket = ticket;
  
      if (options.paths.proxyCallback) {
        debug('pgtUrl is specific(' + options.paths.proxyCallback + '), CAS using proxy mode.');
  
        params.pgtUrl = (pgtCallbackUri.protocol && pgtCallbackUri.host) ? options.paths.proxyCallback : (ctx.origin + options.paths.proxyCallback);//(options.servicePrefix + options.paths.proxyCallback);
  
        debug('params.pgtUrl %s', params.pgtUrl);
      } else {
        debug('pgtUrl is not specific, CAS using none-proxy mode.');
      }
  
      // 用于cas server回调时，设置pgtIou -> pgtId的键值对，用于后面校验
      if (pgtPathname && ctx.path === pgtPathname && ctx.method === 'GET') {
        debug('Receiving pgtIou from CAS server.');
        debug('ctx.path %s', ctx.path);
        debug('pgtPathname %s', pgtPathname);
        debug('ctx.query %s', ctx.query);
  
        if (!ctx.query.pgtIou || !ctx.query.pgtId) {
          debug('Receiving pgtIou from CAS server, but with unexpected pgtIou: ' + ctx.query.pgtIou + ' or pgtId: ' + ctx.query.pgtId);

          return ctx.status = 200;
        }

        // TODO: 需要提供快速过期的实现
        options.store.set(Object.assign(ctx.session, {pgtId: ctx.query.pgtId}), {sid: ctx.query.pgtIou});
        return ctx.status = 200;
      }
  
      // 没ticket，下一步authenticate
      if (!ticket && ctx.path !== options.paths.validate) {
        return next();
      }
      debug('Start trying to valid ticket.');
  
      // 带ticket的话，校验ticket
      // Have I already validated this ticket?
      const storedSession = await options.store.get(ctx.cookies.get(options.sessionKey));
      if (storedSession && storedSession.st && (storedSession.st === ticket)) {
        debug('Find st in store and it\'s the same with the ticket trying to validate. Go throgh it.');
  
        return next();
      } else {
        // 校验ticket
        const casBody = await fetch(options.path + options.paths.serviceValidate + '?' + queryString.stringify(params));
        const text = await casBody.text();
        validateCasResponse(ctx, next, ticket, text, options);
      };
    };
};

/**
 * 解析cas返回的xml，并做相应处理
 *
 * @param ctx
 * @param next
 * @param ticket
 * @param casBody
 * @param options
 */
function validateCasResponse(ctx, next, ticket, casBody, options) {
  xml2js(casBody, {
    explicitRoot: false,
    tagNameProcessors: [stripPrefix]
  }, async function (err, serviceResponse) {
    if (err) {
      debug('Failed to parse CAS server response when trying to validate ticket.');
      debug(err);

      ctx.status = 500;
      return ctx.body = {
        message: 'Failed to parse CAS server response when trying to validate ticket.',
        error: err
      };
    }

    const success = serviceResponse && serviceResponse.authenticationSuccess && serviceResponse.authenticationSuccess[0],
      user = success && success.user && success.user[0],
      pgtIou = success && success.proxyGrantingTicket && success.proxyGrantingTicket[0];

    if (!serviceResponse) {
      debug('Invalid CAS server response.');

      ctx.status = 500;
      return ctx.body = {
        message: 'Invalid CAS server response, serviceResponse empty.'
      };
    }

    // TODO: 不成功回首页
    if (!success) {
      debug('Receive response from CAS when validating ticket, but the validation is failed. Redirect to the last request url: ' + ctx.session.lastUrl);
      if (typeof options.redirect === 'function') {
        return options.redirect(ctx, next);
      }

      return ctx.response.redirect(ctx.session.lastUrl, 302);
    }

    ctx.session.st = ticket;

    // TODO: 需要提供快速过期的实现
    if (ctx.ssoff) {
      options.store.set({sid: ctx.cookies.get(options.sessionKey)}, {sid: ticket});
    }

    ctx.session.cas = {};
    for (let casProperty in success) {
      if (casProperty != 'proxyGrantingTicket') {
        ctx.session.cas[casProperty] = success[casProperty][0];
      }
    }

    if (!pgtIou) {
      if (options.paths.proxyCallback) {
        debug('pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!');

        ctx.status = 401;
        return ctx.body = {
          message: 'pgtUrl is specific, but havn\'t find pgtIou from CAS validation response!'
        };
      } else {
        debug('None-proxy mode, validate ticket succeed, redirecting to lastUrl: ' + ctx.session.lastUrl);

        if (typeof options.redirect === 'function') {
          return options.redirect(ctx, next);
        }

        return ctx.response.redirect(ctx.session.lastUrl || origin(ctx), 302);
      }

      return;
    }

    retrievePGTFromPGTIOU(ctx, next, pgtIou, options);
  });
}

async function retrievePGTFromPGTIOU(ctx, next, pgtIou, options) {
  debug('Trying to retrieve pgtId from pgtIou.');

  const session = await options.store.get(pgtIou);

  if (session && session.pgtId) {
    debug('CAS proxy mode login and validation succeed, pgtId finded. Redirecting to lastUrl: ' + ctx.session.lastUrl);

    ctx.session.pgt = session.pgtId;

    options.store.destroy(pgtIou);
    
    if (typeof options.redirect === 'function' ) {
      return options.redirect(ctx, next);
    }

    return ctx.response.redirect(ctx.session.lastUrl, 302);
  } else {
    debug('CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!');

    ctx.status = 401;
    return ctx.body = {
      message: 'CAS proxy mode login and validation succeed, but can\' find pgtId from pgtIou: `' + pgtIou + '`, maybe something wrong with sessionStroe!'
    };
  }
}
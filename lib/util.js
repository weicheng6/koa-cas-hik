const qs = require('querystring');
const url = require("url");

module.exports.origin = function(ctx) {
  const query = ctx.query;
  if (query.ticket) delete query.ticket;
  const querystring = qs.stringify(query);
  const sp = url.parse(ctx.originalUrl);
  return ctx.origin + ctx.path + (querystring ? '?' + querystring : '');
};

module.exports.checkIgnoreRule = function(ctx, rules, path) {
  if (rules && rules.splice && rules.length) {
    return rules.some(function(rule) {
      if (typeof rule === 'string') {
        return path.indexOf(rule) > -1;
      } else if (rule instanceof RegExp) {
        return rule.test(path);
      } else if (typeof rule === 'function') {
        return rule(path, ctx);
      }
    });
  } else {
    return false;
  }
};
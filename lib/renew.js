const authenticate = require('./authenticate');

module.exports = function(options) {
  if (!options.params) options.params = {};
  options.params.renew = true;

  return authenticate(options);
};

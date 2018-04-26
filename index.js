var configure = require('./lib/configure'),
  serviceValidate = require('./lib/service-validate'),
  authenticate = require('./lib/authenticate'),
  renew = require('./lib/renew'),
  gateway = require('./lib/gateway'),
  ssoff = require('./lib/ssoff'),
  logout = require('./lib/logout'),
  proxyTicket = require('./lib/proxy-ticket');

class CasClient {
  constructor(options){
    this.options = configure(options);
  }

  serviceValidate(){
    return serviceValidate(this.options);
  }

  authenticate(){
    return authenticate(this.options);
  }

  renew(){
    return renew(this.options);
  }

  gateway(){
    return gateway(this.options);
  }

  ssoff(){
    return ssoff(this.options);
  }

  logout(){
    return logout(this.options);
  }

  proxyTicket(pgt, targetService, callback){
    return proxyTicket(pgt, targetService, callback);
  }
}

module.exports = CasClient;
# koa-cas-hik

cas client for koa2

## Deprecated
此cas client为包nodejs-cas的koa版本，其中部分代码按需求进行了改进，依然为标准的cas client，如需使用express,请使用connect-cas2或nodejs-cas。
demo启动方式为node example/index。
如果有防火墙或白名单，请确保您的ip在白名单中。

## Install

    npm install koa-cas-hik
            
## Quick start

```javascript
const path = require('path');
const Koa = require('koa');
const koaBody = require('koa-body');
const views = require('koa-views');
const session = require("koa-session2");
const Store = require('koa-session2/libs/store.js');  //集群时Store请使用redis或其他实现
const CasClient = require('../index');

const app = module.exports = new Koa();
const store = new Store();
const sessionKey = 'koa:sess';
const port = 3000;

const casClient = new CasClient({
    path: 'http://10.33.40.31:8001',
    paths: {
        // validate: '',
        // proxy: '/center/proxy',
        serviceValidate: '/center_cas/ssoService/v1/serviceValidate',
        login: '/center/casLogin',
        logout: '/center_cas/ssoService/v1/logout'
    },
    ajaxHeader: 'X-Requested-With',
    // redirect: (ctx, next) =>  {
    //     ctx.response.redirect(ctx.session.lastUrl, 302);
    // },
    ajaxRedirect: (ctx, next) => {
        ctx.body = {
            redirect: true
        }
    },
    ignore: [
        (path, ctx) => {
        },
        /^\/artemis-web\/static\/.*$/,
        /^\/artemis-web\/debug\/.*$/
    ],
    store: store,
    sessionKey: sessionKey,
    logout:{
        router : '/logout'
        // redirect :  (ctx, next) => {
        //     ctx.response.redirect(options.path + options.paths.logout + '?service=' + encodeURIComponent(ctx.headers.referer || ctx.origin));
        // }
    } 
});

app.use(session({
        key: sessionKey,
        store: store
    }))

    .use(koaBody())

    .use(views(__dirname + '/views', {
        map : {html:'ejs'}
    }))

    //cas中间件——登出
    .use(casClient.logout())
    //cas中间件——cas server调用post登出
    .use(casClient.ssoff())
    //cas中间件——以下为必须
    .use(casClient.serviceValidate())
    .use(casClient.authenticate())

    .use(async(ctx, next) => {
        try {
            const userName = ctx.session.cas.user.split('&&')[1];
            await ctx.render('index.ejs', { userName });
        } catch (error) {
            console.log(error);
        }
    })

    .listen(port, () => {
        console.log(`server start at: http://127.0.0.1:${port}`);
    });
```

## Constructor

```javascript

var casClient = new CasClient(options);

```

### options

#### options.path {String} (Required)

cas server路径，例如： https://www.your-cas-server-path.com/cas

#### options.ignore {Array} (Optional, default: [])

cas 忽略的路径，参数接受一个数组，数组内值可以为正则表达式、function、字符串。

#### options.paths {Object} (Optional, default: {})

详细值如下：

#### options.paths.validate (String) (Optional, default: '')
(For CAS Client)

(nodejs-cas中对options.paths.validate解释如下，但是我在对接过程中并未发现有何作用)
The path you want your CAS client to validate ST from the CAS server. And we'll use `${options.servicePrefix}${options.paths.validate}` as `service` parameter to any CAS server's APIs that need this `service`.

#### options.paths.serviceValidate (String) (Optional, default: '/cas/serviceValidate')
(For CAS Server)

cas client以`${options.path}${options.paths.serviceValidate}`为路径，去cas server验证st是否正确。

#### options.paths.proxy (String) (Optional, default: '/cas/proxy')
(For CAS Server)

Proxy模式下从`${options.path}${options.paths.proxy}`路径获取一个PGT(proxy granting ticket)。

#### options.paths.login (String) (Optional, default: '/cas/login')
(For CAS Server)

CAS server的登录路径。

#### options.paths.logout (String) (Optional, default: '/cas/logout')
(For CAS Server)

CAS server的登出路径。

#### options.paths.proxyCallback (String) (Optional, default: '')
(For CAS Client)

(nodejs-cas中对options.paths.proxyCallback解释如下)
In proxy mode, setting this path means you want this path of your CAS Client to receive the callback from CAS Server(Proxy mode) to receive the PGTIOU and PGTID.

In none-proxy mode, don't set this option!

#### options.ajaxHeader {String} (Optional, default: '')

ajax请求不能重定向，所以请设置一个ajax header值用以区分ajax请求，当遇到ajax请求时，默认返回错误码418，或是设置options.ajaxRedirect实现回调自行处理。

#### options.ajaxRedirect(ctx, next) {Function} (Optional, default: null)

ajax请求过期时执行的回调函数。

#### options.redirect(ctx, next) {Function} (Optional, default: null)

设置options.redirect后，用户登录或登录错误时，cas client的不再重定向至默认的last url，如果你不设置正确的重定向方法，路由跳转将发生错误。（请不要轻易设置此项）

#### options.sessionKey {String} (Optional, default: 'koa:sess')

koa-session2不会像在express中那样将session id保存在session中，此时获取session id需要session保存在cookies中的key值。

#### options.store {Object} (Required)

koa-session2不会像在express中那样将session store保存在req.sessionStore中，所以使用时需要自己实现store，单机时可以使用'koa-session2/libs/store.js'，集群时可以使用redis(参考实现：https://www.npmjs.com/package/koa-session2#custom-stores)。

#### options.logout {Object} (Optional, default: {})

需使用中间件casClient.logout()后生效，也可以自行实现此中间件的功能，详细值如下：

#### options.logout.redirect(ctx, next) {Function} (Optional, default: null)

设置options.logout.redirect后，用户登出时，cas client的不再重定向至默认的url，而是进入此回调方法。

#### options.logout.router {String} (Optional, default: '/logout')

用户登出的路由。

### METHOD

#### CasClient.proxyTicket(pgt, targetService, callback)

(nodejs-cas中对CasClient.proxyTicket)
In proxy mode, request a ticket from CAS server to interact with targetService.

You can receive the ticket by passing a callback function which will be called like: `callback(error, ticket)`, besides, CasClient.proxyTicket will also return a promise,
when resolved, it will pass `ticket` to the resolve function, then you can send it as ticket parameter to request to the other server.

Example:
```javascript
    // In promise way
    CasClient.proxyTicketPromise(req.session.pgt, 'http://your-target-service.com')
      .then(function(ticket) {
        // Then you can send reqeust with parameter ticket http://your-target-service.com/some/path?ticket=${ticket}
      })
      .catch(function(err) {
        throw err
      });

    // or callback
    CasClient.proxyTicketPromise(req.session.pgt, 'http://your-target-service.com', function(error, ticket) {
      if (error) throw error;
      // Then you can send reqeust with parameter ticket http://your-target-service.com/some/path?ticket=${ticket}
    });
```

## License

  MIT

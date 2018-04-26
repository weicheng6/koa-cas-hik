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
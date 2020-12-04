var express = require('express');
var router = express.Router();
var mysql = require('../database');
var table = 'info1920';

const GeetestConfig = require('../geetest_config');
const GeetestLib = require('../sdk/geetest_lib');

var redirectMap = {
  status: '',
  msg: '',
  redirectJump: ''
}

// 验证初始化接口，GET请求
router.get("/register", async function (req, res) {

  const gtLib = new GeetestLib(GeetestConfig.GEETEST_ID, GeetestConfig.GEETEST_KEY);
  const digestmod = "md5";
  const userId = "test";
  const params = { "digestmod": digestmod, "user_id": userId, "client_type": "web", "ip_address": "127.0.0.1" }
  const result = await gtLib.register(digestmod, params);

  req.session[GeetestLib.GEETEST_SERVER_STATUS_SESSION_KEY] = result.status;
  req.session["userId"] = userId;

  res.set('Content-Type', 'application/json;charset=UTF-8')
  return res.send(result.data);
})

// 二次验证接口，POST请求
router.post("/login", async function (req, res) {
  const gtLib = new GeetestLib(GeetestConfig.GEETEST_ID, GeetestConfig.GEETEST_KEY);
  const challenge = req.body[GeetestLib.GEETEST_CHALLENGE];
  const validate = req.body[GeetestLib.GEETEST_VALIDATE];
  const seccode = req.body[GeetestLib.GEETEST_SECCODE];
  // session必须取出值，若取不出值，直接当做异常退出
  const status = req.session[GeetestLib.GEETEST_SERVER_STATUS_SESSION_KEY];
  const userId = req.session["userId"];

  if (status == undefined) {
    return res.json({ "result": "fail", "version": GeetestLib.VERSION, "msg": "session取key发生异常" });
  }
  let result;
  if (status === 1) {
    const params = { "user_id": userId, "client_type": "web", "ip_address": "127.0.0.1" }
    result = await gtLib.successValidate(challenge, validate, seccode, params);
  } else {
    result = gtLib.failValidate(challenge, validate, seccode);
  }

  // 注意，不要更改返回的结构和值类型
  if (result.status === 1) {
    // return res.json({ "result": "success", "version": GeetestLib.VERSION });
    var username = req.body.username;
    var password = req.body.password;
    var query = 'SELECT * FROM user WHERE uid=' + mysql.escape(username) + ' AND password=' + mysql.escape(password);

    mysql.query(query, function (err, rows, fields) {
      if (err) {
        console.log('error', err);
        return;
      }

      if (!rows[0]) {
        redirectMap['status'] = 'fail'
        redirectMap['redirectJump'] = '/'
        redirectMap['msg'] = '用户名或密码错误！';
        res.json(redirectMap);
        return;
      }
      var user = JSON.parse(JSON.stringify(rows[0]));
      console.log(user.username);
      req.session.user = user;

      redirectMap['status'] = 'success';
      redirectMap['redirectJump'] = '/index';
      res.json(redirectMap);
      // return res.json({ "result": "success", "version": GeetestLib.VERSION });
    })
  } else {
    redirectMap['status'] = 'fail'
    redirectMap['redirectJump'] = '/'
    redirectMap['msg'] = '请先完成验证！';
    res.json(redirectMap);
  }
})

/* 登录页面 */
router.get(['/login', '/'], function (req, res, next) {
  if (req.session.user) {
    res.redirect('/index');
    return;
  }
  res.render('login', { title: '登录页面', message: '' });
})

/* 登录验证 */
// router.post('/login', function (req, res, next) {
//   var username = req.body.username;
//   var password = req.body.password;
//   var query = 'SELECT * FROM user WHERE uid=' + mysql.escape(username) + ' AND password=' + mysql.escape(password);

//   mysql.query(query, function (err, rows, fields) {
//     if (err) {
//       console.log('error', err);
//       return;
//     }

//     if (!rows[0]) {
//       redirectMap['status'] = 'fail'
//       redirectMap['redirectJump'] = '/'
//       res.json(redirectMap);
//       return;
//     }
//     var user = JSON.parse(JSON.stringify(rows[0]));
//     console.log(user.username);
//     req.session.user = user;

//     redirectMap['status'] = 'success';
//     redirectMap['redirectJump'] = '/index';
//     redirectMap['msg'] = '用户名或密码错误！';
//     res.json(redirectMap);
//   })
// })

/* 主页面 */
router.get('/index', function (req, res, next) {
  var user = req.session.user;
  if (!user) {
    res.redirect('/login');
    return;
  }
  var query1 = "select column_name,column_comment  from information_schema.Columns where table_name='" + table + "' and table_schema='user'";


  mysql.query(query1, function (err, rows, fields) {
    if (err) {
      console.log(err);
      return;
    }
    let res = JSON.parse(JSON.stringify(rows));
    let map = new Map();
    for (let i = 0; i < res.length; i++) {
      map.set(res[i].COLUMN_NAME, res[i].COLUMN_COMMENT);
    }
    global.infoMap = map;

  })
  // console.log(global.infoMap);

  var query = 'select * from ' + table + ' where uid=' + mysql.escape(user.uid);
  mysql.query(query, function (err, rows, fields) {
    if (err) {
      console.log(err);
      return;
    }
    var info = JSON.parse(JSON.stringify(rows[0]));
    // console.log('query', rows);
    res.render('index', { title: '主页面', info: info, infoMap: global.infoMap });
  })
});

router.post('/edit', function (req, res, next) {
  let args = req.body;
  console.log(args);
  let str = '';
  for (let key in args) {
    str += key + '="' + args[key] + '",';
  }
  let queryArgs = str.slice(0, -1);
  let query = 'update ' + table + ' set ' + queryArgs + ', flag="true"' + ' where uid=' + args.uid;
  // console.log(query);
  mysql.query(query, function (err, rows, fields) {
    if (err) {
      console.log(err);
      return;
    }
    // console.log('估计是提交成功了');
    res.redirect('/index');
  })
})

module.exports = router;

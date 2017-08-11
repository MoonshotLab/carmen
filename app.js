require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const http = require('http').Server(app);
const path = require('path');

const routes = require('./routes');

function checkAuth(req, res, next) {
  console.log('checkAuth ' + req.url);
  console.log('checking auth');

  // don't serve /secure to those not logged in
  // you should add to this list, for each and every secure url
  if (req.url === '/admin' && (!req.session || !req.session.authenticated)) {
    res.redirect('/login');
    return;
  }

  next();
}

app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  require('express-session')({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);
app.use(flash());

// app.use(checkAuth);
app.use('/', routes);

require('./botkit-controller')(app);

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log('Server running on port ' + port);
});

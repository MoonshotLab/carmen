require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const http = require('http').Server(app);
const path = require('path');

const routes = require('./routes');

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

app.use('/', routes);

require('./botkit-controller')(app);

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log('Server running on port ' + port);
});

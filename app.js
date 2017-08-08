require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser= require('body-parser');
const http = require('http').Server(app);
const path = require('path');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); //for parsing url encoded

app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));

require('./botkit-controller')(app);

app.get('/', function(req, res) {
  res.render('index');
});

app.get('*', function(req, res) {
  res.redirect('/');
})

const port = process.env.PORT || 3000;
http.listen(port, function() {
  console.log('Server running on port ' + port);
});

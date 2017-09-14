require('dotenv').config();

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const path = require('path');

app.set('view engine', 'pug');
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

require('./lib/db').initializeDbIfNecessary();
require('./lib/botkit-controller')(app);

app.use('/', require('./routes/index'));
app.use('/logs', require('./routes/logs'));
app.use('/stats', require('./routes/stats'));
app.use('/dl', require('./routes/dl'));

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log('Server running on port ' + port);
});

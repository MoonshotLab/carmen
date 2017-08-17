const express = require('express');
const router = express.Router();
const fs = require('fs');

router.get('/', function(req, res) {
  res.render('index', {
    title: 'Carmen',
    bodyId: 'index'
  });
});

router.get('/logs/:name', function(req, res) {
  const fileRoot = __dirname + '/tmp/data';
  const options = {
    root: fileRoot,
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };

  const fileName = req.params.name;
  if (fs.existsSync(`${fileRoot}/${fileName}`)) {
    res.sendFile(fileName, options, function(err) {
      if (err) {
        next(err);
      } else {
        console.log('Sent:', fileName);
      }
    });
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;

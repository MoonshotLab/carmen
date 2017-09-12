const express = require('express');
const router = express.Router();
const fs = require('fs');

router.get('/', (req, res) => {
  res.redirect('/');
});

router.get('/:name', (req, res) => {
  let fileRoot;

  if (process.env.NODE_ENV === 'dev') {
    fileRoot = __dirname + '/../tmp/data';
  } else {
    fileRoot = '/tmp/data';
  }

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
    res.sendFile(fileName, options, err => {
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

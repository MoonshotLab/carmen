const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    title: 'Carmen',
    bodyId: 'index'
  });
});

module.exports = router;

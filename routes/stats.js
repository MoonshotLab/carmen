const moment = require('moment');
const express = require('express');
const router = express.Router();

const util = require('./../lib/util');
const db = require('./../lib/db');

router.get('/', (req, res) => {
  const statsObj = db.getFormattedStatsObj();

  res.render('stats', {
    stats: statsObj
  });
});

module.exports = router;

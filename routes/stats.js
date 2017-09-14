const moment = require('moment');
const express = require('express');
const router = express.Router();

const util = require('./../lib/util');
const db = require('./../lib/db');

router.get('/', (req, res) => {
  const statsObj = db.getFormattedStatsObj();

  res.render('stats', {
    stats: statsObj,
    formatMoment: date => moment(date).format('l'),
    formatPhone: phone =>
      phone.replace('+1', '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  });
});

module.exports = router;

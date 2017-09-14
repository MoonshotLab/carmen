const express = require('express');
const router = express.Router();

const config = require('./../lib/config');
const db = require('./../lib/db');

router.get('/:resource', (req, res) => {
  const resource = req.params.resource;
  switch (resource) {
    case 'db':
      res.download(config.statsPath);
      break;
    case 'stats':
      const statsData = JSON.stringify(db.getFormattedStatsObj());
      res.setHeader('Content-disposition', 'attachment; filename= stats.json');
      res.setHeader('Content-type', 'application/json');
      res.write(statsData, function(err) {
        res.end();
      });
      break;
    default:
      res.redirect('/');
      break;
  }
});

router.get('/', (req, res) => {
  res.redirect('/');
});

module.exports = router;

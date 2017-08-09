const express = require('express');
const router = express.Router();

router.get('/', function(req, res) {
  res.render('index');
});

router.get('/admin', function(req, res) {
  res.render('admin');
});

router.get('/login', function(req, res) {
  res.render('login', { flash: req.flash() });
});

router.post('/login', function(req, res, next) {
  if (req.body.password && req.body.password === process.env.PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/admin');
  } else {
    req.flash('error', 'Incorrect username / password');
    res.redirect('/login');
  }
});

router.get('/logout', function(req, res, next) {
  delete req.session.authenticated;
  res.redirect('/');
});

module.exports = router;

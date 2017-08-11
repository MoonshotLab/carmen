const low = require('lowdb');
const leven = require('fast-levenshtein');
// const fs = require('fs');

const db = low('db.json');

// Set some defaults if your JSON file is empty
db.defaults({ rooms: [] }).write();

const rooms = require('./rooms.json');

const query = 'gym';

rooms.forEach((room, i) => {
  console.log(room.name);
  console.log(leven.get(query, room.name));
});

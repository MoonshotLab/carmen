const moment = require('moment');
const _ = require('lodash');
const low = require('lowdb');

const config = require('./config');

const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync(config.statsPath);
const db = low(adapter);

const util = require('./util');

function getFormattedStatsObj() {
  const dbVal = _.cloneDeep(db.value()); // gotta clone bc otherwise we'll modify the db, which we don't want to do
  dbVal.total.rooms = util.getSortedRoomListByFrequencyRequested(
    dbVal.total.rooms
  ); // obj -> array

  const weekNum = util.getWeekNum();

  let dbWeek;
  if (_.has(dbVal.weekly, weekNum)) {
    dbWeek = dbVal.weekly[weekNum];
    dbWeek.rooms = util.getSortedRoomListByFrequencyRequested(dbWeek.rooms); // obj -> array
  } else {
    // week doesn't exist, get blank object
    dbWeek = getBlankStatsObj();

    // add blank week to db
    const dbWeeks = dbVal.weekly;
    dbWeeks[weekNum] = dbWeek;
    db.set('weekly', dbWeeks).write();
  }
  dbWeek.num = weekNum;

  const monthNum = util.getMonthNum();
  const monthName = util.getMonthName();

  let dbMonth;
  if (_.has(dbVal.monthly, monthNum)) {
    dbMonth = dbVal.monthly[monthNum];
    dbMonth.rooms = util.getSortedRoomListByFrequencyRequested(dbMonth.rooms); // obj -> array
  } else {
    // month doesn't exist, get blank object
    dbMonth = getBlankStatsObj();

    // add blank month to db
    const dbMonths = dbVal.monthly;
    dbMonths[weekNum] = dbMonth;
    db.set('monthly', dbMonths).write();
  }
  dbMonth.name = monthName;

  const returnObj = {
    week: dbWeek,
    month: dbMonth,
    total: dbVal.total,
    feedback: dbVal.feedback
  };

  return returnObj;
}

function initializeDbIfNecessary() {
  db
    .defaults({
      weekly: {},
      monthly: {},
      total: getBlankStatsObj(),
      feedback: []
    })
    .write();
}

function getBlankRoomObj() {
  return {
    totalRequests: 0,
    mapRequests: 0,
    picRequests: 0
  };
}

function getBlankStatsObj() {
  return {
    messages: {
      received: 0,
      sent: 0,
      understood: 0,
      notUnderstood: 0
    },
    users: [],
    rooms: {}
  };
}

function getDbMonthsAndMonthNum() {
  const months = db.get('monthly').value();
  const monthNum = util.getMonthNum();

  return [months, monthNum];
}

function getDbWeeksAndWeekNum() {
  const dbWeeks = db.get('weekly').value();
  const weekNum = util.getWeekNum();

  return [dbWeeks, weekNum];
}

function makeSureWeekExistsInDb() {
  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();

  if (_.has(dbWeeks, weekNum) !== true) {
    // week doesn't exist in db, initialize
    dbWeeks[weekNum] = getBlankStatsObj();
    db.set('weekly', dbWeeks).write();
  }

  return;
}

function makeSureMonthExistsInDb() {
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();

  if (_.has(dbMonths, monthNum) !== true) {
    // month doesn't exist in db, initialize
    dbMonths[monthNum] = getBlankStatsObj();
    db.set('monthly', dbMonths).write();
  }

  return;
}

function makeSureWeekAndMonthExistInDb() {
  makeSureWeekExistsInDb();
  makeSureMonthExistsInDb();
}

function incrementMessageReceivedCount() {
  // weekly
  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  dbWeeks[weekNum].messages.received++;
  db.set('weekly', dbWeeks).write();

  // monthly
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  dbMonths[monthNum].messages.received++;
  db.set('monthly', dbMonths).write();

  // total
  const dbTotal = db.get('total').value();
  dbTotal.messages.received++;
  db.set('total', dbTotal).write();

  return;
}

function logUserMessage(number) {
  // weekly
  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  if (dbWeeks[weekNum].users.includes(number) !== true) {
    dbWeeks[weekNum].users.push(number);
    db.set('weekly', dbWeeks).write();
  }

  // monthly
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  if (dbMonths[monthNum].users.includes(number) !== true) {
    dbMonths[monthNum].users.push(number);
    db.set('monthly', dbMonths).write();
  }

  // total
  const dbTotal = db.get('total').value();
  if (dbTotal.users.includes(number) !== true) {
    dbTotal.users.push(number);
    db.set('total', dbTotal).write();
  }

  return;
}

function logRoomRequested(room) {
  const camelRoom = _.camelCase(room); // make sure

  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  const dbTotal = db.get('total').value();

  if (_.has(dbWeeks[weekNum].rooms, camelRoom) !== true) {
    dbWeeks[weekNum].rooms[camelRoom] = getBlankRoomObj();
  }

  if (_.has(dbMonths[monthNum].rooms, camelRoom) !== true) {
    dbMonths[monthNum].rooms[camelRoom] = getBlankRoomObj();
  }

  if (_.has(dbTotal.rooms, camelRoom) !== true) {
    dbTotal.rooms[camelRoom] = getBlankRoomObj();
  }

  dbWeeks[weekNum].rooms[camelRoom].totalRequests++;
  dbMonths[monthNum].rooms[camelRoom].totalRequests++;
  dbTotal.rooms[camelRoom].totalRequests++;

  db.set('weekly', dbWeeks).write();
  db.set('monthly', dbMonths).write();
  db.set('total', dbTotal).write();

  return;
}

function logRoomImageRequested(room, imageType) {
  const camelRoom = _.camelCase(room); // make sure

  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  const dbTotal = db.get('total').value();

  if (_.has(dbWeeks[weekNum].rooms, camelRoom) !== true) {
    dbWeeks[weekNum].rooms[camelRoom] = getBlankRoomObj();
  }

  if (_.has(dbMonths[monthNum].rooms, camelRoom) !== true) {
    dbMonths[monthNum].rooms[camelRoom] = getBlankRoomObj();
  }

  if (_.has(dbTotal.rooms, camelRoom) !== true) {
    dbTotal.rooms[camelRoom] = getBlankRoomObj();
  }

  if (imageType === 'pic') {
    dbWeeks[weekNum].rooms[camelRoom].picRequests++;
    dbMonths[monthNum].rooms[camelRoom].picRequests++;
    dbTotal.rooms[camelRoom].picRequests++;
  } else if (imageType === 'map') {
    dbWeeks[weekNum].rooms[camelRoom].mapRequests++;
    dbMonths[monthNum].rooms[camelRoom].mapRequests++;
    dbTotal.rooms[camelRoom].mapRequests++;
  }

  db.set('weekly', dbWeeks).write();
  db.set('monthly', dbMonths).write();
  db.set('total', dbTotal).write();

  return;
}

function logUserFeedback(text, sender) {
  db
    .get('feedback')
    .push({
      from: sender,
      text: text,
      date: moment()
    })
    .write();

  return;
}

function logMessageReceived(message) {
  makeSureWeekAndMonthExistInDb();
  incrementMessageReceivedCount();
  logUserMessage(message.from);

  switch (message.type) {
    case 'room':
      logRoomRequested(message.room);
      logMessageUnderstood();
      break;
    case 'roomImage':
      logRoomImageRequested(message.room, message.imageType);
      logMessageUnderstood();
      break;
    case 'feedback':
      logUserFeedback(message.feedback, message.from);
      logMessageUnderstood();
      break;
    case 'other':
      logMessageUnderstood();
      break;
    case 'notUnderstood':
      logMessageNotUnderstood();
      break;
  }

  return;
}

function logMessageSent() {
  makeSureWeekAndMonthExistInDb();

  // weekly
  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  dbWeeks[weekNum].messages.sent++;
  db.set('weekly', dbWeeks).write();

  // monthly
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  dbMonths[monthNum].messages.sent++;
  db.set('monthly', dbMonths).write();

  // total
  const dbTotal = db.get('total').value();
  dbTotal.messages.sent++;
  db.set('total', dbTotal).write();

  return;
}

function logMessageUnderstood(understood = true) {
  const [dbWeeks, weekNum] = getDbWeeksAndWeekNum();
  const [dbMonths, monthNum] = getDbMonthsAndMonthNum();
  const dbTotal = db.get('total').value();

  if (understood === true) {
    dbWeeks[weekNum].messages.understood++;
    dbMonths[monthNum].messages.understood++;
    dbTotal.messages.understood++;
  } else {
    dbWeeks[weekNum].messages.notUnderstood++;
    dbMonths[monthNum].messages.notUnderstood++;
    dbTotal.messages.notUnderstood++;
  }

  db.set('weekly', dbWeeks).write();
  db.set('monthly', dbMonths).write();
  db.set('total', dbTotal).write();

  return;
}

function logMessageNotUnderstood() {
  logMessageUnderstood(false);

  return;
}

exports.logMessageReceived = logMessageReceived;
exports.logMessageSent = logMessageSent;
exports.initializeDbIfNecessary = initializeDbIfNecessary;
exports.getFormattedStatsObj = getFormattedStatsObj;

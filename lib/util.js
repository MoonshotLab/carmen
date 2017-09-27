const moment = require('moment');
const path = require('path');
const leven = require('fast-levenshtein');
const Promise = require('bluebird');
const fs = require('fs');
const _ = require('lodash');

const config = require('./config');
const db = require('./db');

const utterances = require('../utterances.json');

function getRegexPatternFromRoomName(roomName) {
  return new RegExp(`(^|[^a-zA-Z])${roomName}(?![a-zA-Z])`, 'i'); // only match a string if it's not surrounded by other letters (so 'hr' doesn't match 'bathroom' 😅)
}

const rooms = require('../rooms.json');
const roomList = rooms.map(roomObj => {
  const roomName = roomObj.name;
  const returnObj = {
    name: roomName,
    pattern: getRegexPatternFromRoomName(roomName)
  };

  if (_.has(roomObj, 'alternateNames') && roomObj.alternateNames.length > 0) {
    returnObj.alternateNames = roomObj.alternateNames;
  }

  return returnObj;
});

function getRoomListRegexes() {
  let regexes = [];
  for (let i = 0; i < roomList.length; i++) {
    const room = roomList[i];
    regexes.push(room.pattern);
    if (_.has(room, 'alternateNames')) {
      for (let j = 0; j < room.alternateNames.length; j++) {
        regexes.push(getRegexPatternFromRoomName(room.alternateNames[j]));
      }
    }
  }

  return regexes;
}

function searchForRoom(query) {
  for (let i = 0; i < roomList.length; i++) {
    const pattern = roomList[i].pattern;
    if (query.match(pattern)) {
      const name = roomList[i].name;
      return name;
    }
  }

  return null;
}

function getMonthName() {
  return moment().format('MMMM');
}

function getMonthNum() {
  return moment().month() + 1; // => [1, 12]
}

function getWeekNum() {
  return moment().week(); // => [1, 52]
}

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// camelCase => Camel Case
function getRoomNameLookupObj() {
  const returnObj = {};

  _.mapKeys(rooms, (val, key) => {
    returnObj[_.camelCase(val.name)] = val.name;
  });

  return returnObj;
}

function getSortedRoomListByFrequencyRequested(roomsObj) {
  // turn obj into array
  const roomList = [];
  const roomNameLookupObj = getRoomNameLookupObj();

  _.mapKeys(roomsObj, (val, key) => {
    roomList.push(Object.assign(val, { name: roomNameLookupObj[key] }));
  });

  roomList.sort((a, b) => b.totalRequests - a.totalRequests);

  return roomList;
}

function getUtteranceByType(type) {
  switch (type) {
    case 'greeting':
      return randomPick(utterances.greeting);
    case 'thanks':
      return randomPick(utterances.thanks);
    case 'idk':
      return randomPick(utterances.idk);
    case 'farewell':
      return randomPick(utterances.farewell);
    default:
      return null;
  }
}

function asyncUpdateUserObj(controller, userObj) {
  userObj.lastInteraction = moment();
  userObj.interactions++;
  userObj.new = false;
  return asyncSaveUserObj(controller, userObj);
}

function asyncUpdateUserLastRoom(controller, userObj, roomObj) {
  userObj.lastRoom = roomObj;
  return asyncUpdateUserObj(controller, userObj);
}

function asyncGetUser(controller, id) {
  return new Promise((resolve, reject) => {
    return asyncGetUserFromStorage(controller, id)
      .then(user => {
        resolve(user);
      })
      .catch(err => {
        // error getting user, start from scratch
        console.log('err', err);
        let userObj = getBlankUserObj(id);
        console.log(`User not found, starting from scratch`);
        console.log(userObj);
        asyncSaveUserObj(controller, userObj)
          .then(user => {
            resolve(user);
          })
          .catch(err => {
            reject(err);
          });
      });
  });
}

function asyncSaveUserObj(controller, user) {
  return new Promise((resolve, reject) => {
    controller.storage.users.save(user, function(err) {
      if (err) {
        console.log('save err', err);
        reject(err);
      } else {
        resolve(user);
      }
    });
  });
}

function asyncGetUserFromStorage(controller, id) {
  return new Promise((resolve, reject) => {
    let user = null;

    controller.storage.users.get(id, function(err, user_data) {
      if (err) {
        console.log(`Error getting user ${id}`);
        reject(err);
      } else {
        if (!!user_data) {
          user = user_data;
          resolve(user);
        } else {
          reject();
        }
      }
    });
  });
}

function getBlankUserObj(number) {
  return {
    id: number,
    lastRoom: {},
    interactions: 0,
    lastInteraction: '',
    created: moment(),
    new: true
  };
}

function log(str, type = null) {
  let filePath = config.logPath;

  switch (type) {
    case 'feedback':
      filePath = config.feedbackPath;
      break;
    case 'error':
      filePath = config.errorPath;
      break;
    case 'unknown':
      filePath = config.unknownPath;
      break;
  }

  let logStr = `[${moment().format('MM/DD/YY HH:mm:ss')}] ${str}`;
  console.log(logStr);

  logStr += '\n';

  return new Promise((resolve, reject) => {
    fs.appendFile(filePath, logStr, err => {
      reject(err);
    });

    resolve();
  });
}

function logFeedbackReceived(message) {
  log(
    `Received feedback '${message.fullText}' from ${message.from}`,
    'feedback'
  );
}

function logImageSent(url, to) {
  log(`Sent image '${url}' to ${to}`);
}

function logMessageReceived(message) {
  log(`Received message '${message.fullText}' from ${message.from}`);
}

function logQuestionAnswered(message, to) {
  log(`Received answer '${message}' from ${to}`);
}

function logMessageSent(message, to) {
  log(`Sending message '${message}' to ${to}`);
}

function logQuestionAsked(message, to) {
  log(`Asking question '${message}' to ${to}`);
}

function logUnknownInput(message) {
  log(`Unknown input '${message.fullText}' from ${message.from}`, 'unknown');
}

function replyToMessage(bot, message, text) {
  logMessageSent(text, message.from);
  db.logMessageSent();

  bot.reply(message, text, (err, res) => {
    if (err) {
      console.log('Error replying to message', err);
    }
  });
}

function getRoomFromRoomList(searchRoom) {
  if (!!searchRoom && searchRoom.length > 0) {
    let camelSearchRoom = _.camelCase(searchRoom);

    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i];
      if (camelSearchRoom === _.camelCase(room.name)) {
        return room;
      }

      // room name wasn't found, look for alternates
      if (!!room.alternateNames && room.alternateNames.length > 0) {
        for (let j = 0; j < room.alternateNames.length; j++) {
          if (camelSearchRoom === _.camelCase(room.alternateNames[j])) {
            return room;
          }
        }
      }
    }
  }

  return null;
}

function removeQuestionWordsFromString(str) {
  const phrasesToRemove = [
    'where is',
    `where's`,
    'find',
    'help me find',
    'locate',
    'search',
    'tell me'
  ];

  phrasesToRemove.forEach(phrase => (str = str.replace(phrase, '')));
  return str.trim();
}

function getRoomFromRoomListUsingLevensheinDistance(query) {
  let [bestMatch, bestDistance] = [null, Infinity];

  if (!!query && query.length > 0) {
    const camelQuery = _.camelCase(query);
    rooms.forEach(room => {
      let distance = leven.get(camelQuery, _.camelCase(room.name));
      if (distance < bestDistance) {
        bestMatch = room;
        bestDistance = distance;
      }
    });
  }

  // only tolerate a threshold distance, otherwise gobbledigook will match
  if (bestDistance <= config.levenThreshold) {
    return bestMatch;
  } else {
    return null;
  }
}

function getFollowUpCopy(roomObj) {
  const roomPic = 'pic' in roomObj.img === true;
  const roomMap = 'map' in roomObj.img === true;

  if (roomPic && roomMap) {
    return `Need more help? Reply 'P' for a picture of the room, or 'M' for a map.`;
  } else if (roomPic) {
    return `Need more help? Reply 'P' for a picture of the room.`;
  } else if (roomMap) {
    return `Need more help? Reply 'M' for a map of the room.`;
  }

  return null;
}

function sendFollowUpCopy(copy, convo) {
  logQuestionAsked(copy, message.from);
  convo.ask(copy, [
    {
      pattern: /^(picture|pic|p|P)/i,
      callback: (res, convo) => {
        logQuestionAnswered(res.text, message.to);

        const messageToSend = roomObj.location;

        logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    },
    {
      pattern: /^(map|m|M)/i,
      callback: (res, convo) => {
        logQuestionAnswered(res.text, message.to);

        const messageToSend = `Unfortunately, I don't understand what you're asking. Maybe try asking a different way, or check your spelling! 🤷‍`;
        logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    },
    {
      default: true,
      callback: (res, convo) => {
        logQuestionAnswered(res.text, message.to);

        const messageToSend = `I don't understand. Maybe try asking a different way!`;
        logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    }
  ]);
}

function followUpIfNecessary(bot, message, roomObj) {
  if ('img' in roomObj) {
    // follow up with pics
    const followUpCopy = getFollowUpCopy(roomObj);

    setTimeout(() => {
      // wait a few seconds to make sure these send in the correct order
      bot.reply(message, followUpCopy);
    }, config.followUpTimeout);
  }
}

exports.asyncUpdateUserObj = asyncUpdateUserObj;
exports.asyncUpdateUserLastRoom = asyncUpdateUserLastRoom;
exports.asyncGetUser = asyncGetUser;
exports.asyncSaveUserObj = asyncSaveUserObj;
exports.asyncGetUserFromStorage = asyncGetUserFromStorage;
exports.getBlankUserObj = getBlankUserObj;
exports.log = log;
exports.logFeedbackReceived = logFeedbackReceived;
exports.logUnknownInput = logUnknownInput;
exports.logImageSent = logImageSent;
exports.logMessageReceived = logMessageReceived;
exports.logQuestionAnswered = logQuestionAnswered;
exports.logMessageSent = logMessageSent;
exports.logQuestionAsked = logQuestionAsked;
exports.replyToMessage = replyToMessage;
exports.getRoomFromRoomList = getRoomFromRoomList;
exports.removeQuestionWordsFromString = removeQuestionWordsFromString;
exports.getRoomFromRoomListUsingLevensheinDistance = getRoomFromRoomListUsingLevensheinDistance;
exports.getFollowUpCopy = getFollowUpCopy;
exports.sendFollowUpCopy = sendFollowUpCopy;
exports.followUpIfNecessary = followUpIfNecessary;
exports.getUtteranceByType = getUtteranceByType;
exports.getMonthNum = getMonthNum;
exports.getWeekNum = getWeekNum;
exports.getSortedRoomListByFrequencyRequested = getSortedRoomListByFrequencyRequested;
exports.getMonthName = getMonthName;
exports.searchForRoom = searchForRoom;
exports.getRoomListRegexes = getRoomListRegexes;

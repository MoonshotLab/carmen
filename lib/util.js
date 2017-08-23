const moment = require('moment');
const path = require('path');
const leven = require('fast-levenshtein');
const Promise = require('bluebird');
const fs = require('fs');
const config = require('./config');

const rooms = require('../rooms.json');
const roomList = rooms.map(roomObj => roomObj.name);

const asyncUpdateUserObj = (controller, userObj) => {
  userObj.lastInteraction = moment();
  userObj.interactions++;
  return asyncSaveUserObj(controller, userObj);
};

const asyncUpdateUserLastRoom = (controller, userObj, roomObj) => {
  userObj.lastRoom = roomObj;
  return asyncUpdateUserObj(controller, userObj);
};

const asyncGetUser = (controller, id) => {
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
};

const asyncSaveUserObj = (controller, user) => {
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
};

const asyncGetUserFromStorage = (controller, id) => {
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
};

const getBlankUserObj = number => {
  return {
    id: number,
    lastRoom: {},
    interactions: 0,
    lastInteraction: '',
    created: moment()
  };
};

const log = (str, type = null) => {
  let filePath = config.logPath;

  switch (type) {
    case 'feedback':
      filePath = config.feedbackPath;
      break;
    case 'error':
      filePath = config.errorPath;
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
};

const logFeedbackReceived = message => {
  log(`Received feedback '${message.text}' from ${message.from}`, 'feedback');
};

const logImageSent = (url, to) => {
  log(`Sent image '${url}' to ${to}`);
};

const logMessageReceived = message => {
  log(`Received message '${message.text}' from ${message.from}`);
};

const logQuestionAnswered = (message, to) => {
  log(`Received answer '${message}' from ${to}`);
};

const logMessageSent = (message, to) => {
  log(`Sending message '${message}' to ${to}`);
};

const logQuestionAsked = (message, to) => {
  log(`Asking question '${message}' to ${to}`);
};

const replyToMessage = (bot, message, text) => {
  logMessageSent(text, message.from);
  bot.reply(message, text);
};

const getRoomFromRoomList = searchRoom => {
  if (!!searchRoom && searchRoom.length > 0) {
    const lowerSearchRoom = searchRoom.toLowerCase();

    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i];
      if (lowerSearchRoom === room.name.toLowerCase()) return room;
    }
  }

  return null;
};

const removeQuestionWordsFromString = str => {
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
};

const getRoomFromRoomListUsingLevensheinDistance = query => {
  let [bestMatch, bestDistance] = [null, Infinity];

  if (!!query && query.length > 0) {
    const lowerQuery = query.toLowerCase();
    rooms.forEach(room => {
      let distance = leven.get(lowerQuery, room.name.toLowerCase());
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
};

const getFollowUpCopy = roomObj => {
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
};

const sendFollowUpCopy = (copy, convo) => {
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
};

const followUpIfNecessary = (bot, message, roomObj) => {
  if ('img' in roomObj) {
    // follow up with pics
    const followUpCopy = getFollowUpCopy(roomObj);

    setTimeout(() => {
      // wait a few seconds to make sure these send in the correct order
      bot.reply(message, followUpCopy);
    }, config.followUpTimeout);
  }
};

module.exports = {
  asyncUpdateUserObj: asyncUpdateUserObj,
  asyncUpdateUserLastRoom: asyncUpdateUserLastRoom,
  asyncGetUser: asyncGetUser,
  asyncSaveUserObj: asyncSaveUserObj,
  asyncGetUserFromStorage: asyncGetUserFromStorage,
  getBlankUserObj: getBlankUserObj,
  log: log,
  logFeedbackReceived: logFeedbackReceived,
  logImageSent: logImageSent,
  logMessageReceived: logMessageReceived,
  logQuestionAnswered: logQuestionAnswered,
  logMessageSent: logMessageSent,
  logQuestionAsked: logQuestionAsked,
  replyToMessage: replyToMessage,
  getRoomFromRoomList: getRoomFromRoomList,
  removeQuestionWordsFromString: removeQuestionWordsFromString,
  getRoomFromRoomListUsingLevensheinDistance: getRoomFromRoomListUsingLevensheinDistance,
  getFollowUpCopy: getFollowUpCopy,
  sendFollowUpCopy: sendFollowUpCopy,
  followUpIfNecessary: followUpIfNecessary
};

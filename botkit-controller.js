const TwilioSMSBot = require('botkit-sms');
const leven = require('fast-levenshtein');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const moment = require('moment');

const logPath = './public/logs/test.log';

const rooms = require('./rooms.json');
const roomList = rooms.map(roomObj => roomObj.name);

const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER
});
const bot = controller.spawn({});

function log(str) {
  let logStr = `[${moment().format('MM/DD/YY HH:mm:ss')}] ${str}`;
  console.log(logStr);

  logStr += '\n';

  return new Promise((resolve, reject) => {
    fs.appendFile(logPath, logStr, err => {
      reject(err);
    });

    resolve();
  });
}

function logMessageReceived(message) {
  log(`Received message '${message.text}' from ${message.from}`);
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

function replyToMessage(message, text) {
  logMessageSent(text, message.from);
  bot.reply(message, text);
}

function getRoomFromRoomList(searchRoom) {
  if (!!searchRoom && searchRoom.length > 0) {
    const lowerSearchRoom = searchRoom.toLowerCase();

    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i];
      if (lowerSearchRoom === room.name.toLowerCase()) return room;
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
  if (bestDistance <= 3) {
    return bestMatch;
  } else {
    return null;
  }
}

module.exports = function(app) {
  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    log('TwilioSMSBot is online!');
  });

  controller.hears(roomList, 'message_received', (bot, message) => {
    logMessageReceived(message);
    if (!!message.match && message.match.length > 0) {
      const roomObj = getRoomFromRoomList(message.match[0]);
      if (roomObj && roomObj.location) {
        replyToMessage(message, roomObj.location);
      } else {
        replyToMessage(
          message,
          `Sorry, I'm not sure where that is. Maybe ask Eddie?`
        );
      }
    } else {
      replyToMessage(
        message,
        `Sorry, I'm not sure where that is. Maybe ask Eddie?`
      );
    }
  });

  controller.hears(
    ['hi', 'hello', 'who are you', 'what is this'],
    'message_received',
    (bot, message) => {
      logMessageReceived(message);
      replyToMessage(
        message,
        `Hi there! I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. To use me, just ask, "Where's Uranus", for example.`
      );
    }
  );

  controller.hears(
    ['thanks', 'thank you'],
    'message_received',
    (bot, message) => {
      logMessageReceived(message);
      replyToMessage(message, `You're welcome!`);
    }
  );

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      logMessageReceived(message);
      const query = removeQuestionWordsFromString(message.text);
      const roomObj = getRoomFromRoomListUsingLevensheinDistance(query);

      if (roomObj !== null) {
        const question = `I'm not exactly sure what you meant. Where you asking how to find ${roomObj.name}?`;
        logQuestionAsked(question, message.from);
        convo.ask(question, [
          {
            pattern: bot.utterances.yes,
            callback: (res, convo) => {
              logQuestionAnswered(res.text, message.to);

              const messageToSend = roomObj.location;
              logMessageSent(messageToSend, message.from);
              convo.say(messageToSend);
              convo.next();
            }
          },
          {
            pattern: bot.utterances.no,
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
      } else {
        const messageToSend = `I'm not sure what you mean. Try asking a different way!`;
        logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    });
  });
};

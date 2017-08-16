const TwilioSMSBot = require('botkit-sms');
const leven = require('fast-levenshtein');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const moment = require('moment');

const logPath = './public/logs/conversation.log';

const rooms = require('./rooms.json');
const roomList = rooms.map(roomObj => roomObj.name);

const levenThreshold = 5;

const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER,
  json_file_store: 'public/logs/conversation/'
});
const bot = controller.spawn({});
let lastRoom = null; // keep track of the last room user asked about

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

function logImageSent(url, to) {
  log(`Sent image '${url}' to ${to}`);
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
  if (bestDistance <= levenThreshold) {
    return bestMatch;
  } else {
    return null;
  }
}

function followUpWithPicsIfAvailable(roomObj, convo, message) {
  if ('img' in roomObj) {
    followUpWithPics(roomObj, convo, message);
  }
}

function getFollowUpCopy(roomPic, roomMap) {
  if (roomPic && roomMap) {
    return `Need more help? Reply 'P' for a picture of the room, or 'M' for a map.`;
  } else if (roomPic) {
    return `Need more help? Reply 'P' for a picture of the room.`;
  } else if (roomMap) {
    return `Need more help? Reply 'M' for a map of the room.`;
  }

  return null;
}

function followUpWithPics(roomObj, convo, message) {
  const roomPic = 'pic' in roomObj.img === true;
  const roomMap = 'map' in roomObj.img === true;

  const followUpCopy = getFollowUpCopy(roomPic, roomMap);

  let responseArray = [
    {
      default: true,
      callback: (res, convo) => {
        convo.next();
      }
    }
  ];

  if (roomPic) {
    responseArray.push({
      pattern: /^(picture|pic|p|P)/i,
      callback: (res, convo) => {
        const imgUrl = `${process.env.SITE_URL}/${roomObj.img.pic}`;
        logImageSent(imgUrl, message.from);
        convo.say(
          'Coming your way! Images take a moment to send, so please be patient.'
        );

        convo.context.bot.reply(message, {
          mediaUrl: imgUrl
        });
        convo.next();
      }
    });
  }

  if (roomMap) {
    responseArray.push({
      pattern: /^(map|m|M)/i,
      callback: (res, convo) => {
        const imgUrl = `${process.env.SITE_URL}/${roomObj.img.map}`;
        logImageSent(imgUrl, message.from);
        convo.say(
          'Coming your way! Images take a moment to send, so please be patient.'
        );

        convo.context.bot.reply(message, {
          mediaUrl: imgUrl
        });
        convo.next();
      }
    });
  }

  convo.ask(followUpCopy, responseArray);
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

module.exports = function(app) {
  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    log('TwilioSMSBot is online!');
  });

  controller.hears(roomList, 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      logMessageReceived(message);
      let roomFound = false;

      if (!!message.match && message.match.length > 0) {
        const roomObj = getRoomFromRoomList(message.match[0]);

        if (roomObj && roomObj.location) {
          lastRoom = roomObj;
          roomFound = true;

          const messageToSend = roomObj.location;
          logMessageSent(messageToSend, message.from);
          convo.say(messageToSend);

          followUpWithPicsIfAvailable(roomObj, convo, message); // give the option of sending a picture or a map of the room, if available
        }
      }

      if (roomFound !== true) {
        const messageToSend = `Sorry, I'm not sure where that is. Maybe ask Eddie?`;
        logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    });
  });

  controller.hears(
    ['hi', 'hello', 'who are you', 'what is this'],
    'message_received',
    (bot, message) => {
      logMessageReceived(message);
      replyToMessage(
        message,
        `Hi there. I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. To use me, just ask, "Where's Uranus?", for example.`
      );
    }
  );

  // controller.hears(['help', 'commands'], 'message_received', (bot, message) => {
  //   logMessageReceived(message);
  //   replyToMessage(
  //     message,
  //     `Hi there. I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. You can ask me how to find any room in the building. You can also just send me the name of the room. Add `
  //   );
  // });

  controller.hears(
    ['thanks', 'thank you'],
    'message_received',
    (bot, message) => {
      logMessageReceived(message);
      replyToMessage(message, `You're welcome!`);
    }
  );

  controller.hears(['P', 'M'], 'message_received', (bot, message) => {
    if (lastRoom !== null && 'img' in lastRoom) {
      let match = message.match[0];
      if (match === 'P' && 'pic' in lastRoom.img) {
        const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.pic}`;
        logImageSent(imgUrl, message.from);
        bot.reply(
          message,
          'Coming your way! Images take a moment to send, so please be patient.'
        );

        bot.reply(message, {
          mediaUrl: imgUrl
        });
      } else if (match === 'M' && 'map' in lastRoom.img) {
        const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.map}`;
        logImageSent(imgUrl, message.from);
        bot.reply(
          message,
          'Coming your way! Images take a moment to send, so please be patient.'
        );

        bot.reply(message, {
          mediaUrl: imgUrl
        });
      } else {
        const messageToSend = `I'm not sure what you mean. Try asking a different way!`;
        logMessageSent(messageToSend, message.from);
        bot.reply(message, messageToSend);
      }
    } else {
      const messageToSend = `I'm not sure what you mean. Try asking a different way!`;
      logMessageSent(messageToSend, message.from);
      bot.reply(message, messageToSend);
    }
  });

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      logMessageReceived(message);
      const query = removeQuestionWordsFromString(message.text);
      const roomObj = getRoomFromRoomListUsingLevensheinDistance(query);

      if (roomObj !== null) {
        const question = `I'm not exactly sure what you meant. Were you asking how to find ${roomObj.name}?`;
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

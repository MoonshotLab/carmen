const TwilioSMSBot = require('botkit-sms');
const leven = require('fast-levenshtein');

const rooms = require('./rooms.json');
const roomList = rooms.map(roomObj => roomObj.name);

const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER
});

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
  let bot = controller.spawn({});

  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    console.log('TwilioSMSBot is online!');
  });

  controller.hears(roomList, 'message_received', (bot, message) => {
    if (!!message.match && message.match.length > 0) {
      const roomObj = getRoomFromRoomList(message.match[0]);
      if (roomObj && roomObj.location) {
        bot.reply(message, roomObj.location);
      } else {
        bot.reply(
          message,
          `Sorry, I'm not sure where that is. Maybe ask Eddie?`
        );
      }
    } else {
      bot.reply(message, `Sorry, I'm not sure where that is. Maybe ask Eddie?`);
    }
  });

  controller.hears(
    ['hi', 'hello', 'who are you', 'what is this'],
    'message_received',
    (bot, message) => {
      bot.reply(
        message,
        `Hi there! I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. To use me, just ask, "Where's Uranus", for example.`
      );
    }
  );

  controller.hears(
    ['thanks', 'thank you'],
    'message_received',
    (bot, message) => {
      bot.reply(message, `You're welcome!`);
    }
  );

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      if (convo) console.log(err);
      const query = removeQuestionWordsFromString(message.text);
      const roomObj = getRoomFromRoomListUsingLevensheinDistance(query);

      if (roomObj !== null) {
        convo.ask(
          `I'm not exactly sure what you meant. Where you asking how to find ${roomObj.name}?`,
          [
            {
              pattern: bot.utterances.yes,
              callback: (res, convo) => {
                convo.say(roomObj.location);
                convo.next();
              }
            },
            {
              pattern: bot.utterances.no,
              callback: (res, convo) => {
                convo.say(
                  `Unfortunately, I don't understand what you're asking. Maybe try asking a different way, or check your spelling! 🤷‍`
                );
                convo.next();
              }
            },
            {
              default: true,
              callback: (res, convo) => {
                convo.say(
                  `I don't understand. Maybe try asking a different way!`
                );
                convo.next();
              }
            }
          ]
        );
      } else {
        convo.say(`I'm not sure what you mean. Try asking a different way!`);
        convo.next();
      }
    });
  });
};

const TwilioSMSBot = require('botkit-sms');

const config = require('./config');

const rooms = require('../rooms.json');
const roomList = rooms.map(roomObj => roomObj.name);

const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER,
  json_file_store: '/tmp/data/conversation'
});
const bot = controller.spawn({});

const util = require('./util');

module.exports = function(app) {
  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    util.log('TwilioSMSBot is online!');
  });

  controller.hears(
    ['feedback', 'suggestion'],
    'message_received',
    (bot, message) => {
      util.logFeedbackReceived(message);
      util.replyToMessage(bot, message, `Thanks for the suggestion!`);
    }
  );

  controller.hears(roomList, 'message_received', (bot, message) => {
    util
      .asyncGetUser(controller, message.user)
      .then(user => {
        util.logMessageReceived(message);
        let roomFound = false;

        if (!!message.match && message.match.length > 0) {
          const roomObj = util.getRoomFromRoomList(message.match[0]);

          if (roomObj && roomObj.location) {
            util.asyncUpdateUserLastRoom(controller, user, roomObj);

            roomFound = true;

            const messageToSend = roomObj.location;
            util.logMessageSent(messageToSend, message.from);
            bot.reply(message, messageToSend);
            util.followUpIfNecessary(bot, message, roomObj);
          }
        }

        if (roomFound !== true) {
          const messageToSend = `Sorry, I'm not sure where that is. Maybe ask Eddie?`;
          util.logMessageSent(messageToSend, message.from);
          bot.reply(message, messageToSend);
        }
      })
      .catch(err => {
        util.log(err, 'error');
        bot.reply(
          `Oops, something went wrong! Don't worry, we're looking into it.`
        );
      });
  });

  controller.hears(
    ['hi', 'hello', 'who are you', 'what is this'],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(
        bot,
        message,
        `Hi there. I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. To use me, just ask, "Where's Uranus?", for example.`
      );
    }
  );

  // controller.hears(['help', 'commands'], 'message_received', (bot, message) => {
  //   util.logMessageReceived(message);
  //   util.replyToMessage(bot,
  //     message,
  //     `Hi there. I'm Carmen, a chatbot made by Moonshot to help you find any room in the building. You can ask me how to find any room in the building. You can also just send me the name of the room. Add `
  //   );
  // });

  controller.hears(
    ['^ok$', '^OK$', '^Ok$', '^okay$', '^OKAY$'],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(bot, message, `Sure!`);
    }
  );

  controller.hears(
    ['thanks', 'thank you'],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(bot, message, `You're welcome!`);
    }
  );

  controller.hears(['^P$', '^picture$'], 'message_received', (bot, message) => {
    util
      .asyncGetUser(controller, message.user)
      .then(user => {
        let lastRoom = user.lastRoom;

        if (lastRoom !== null) {
          if ('img' in lastRoom && 'pic' in lastRoom.img) {
            const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.pic}`;
            util.logImageSent(imgUrl, message.from);

            const responseText = util.getImagesSentCopyFromImgUrl(imgUrl);
            bot.reply(message, responseText);

            bot.reply(message, {
              mediaUrl: imgUrl
            });
          } else {
            bot.reply(message, `Sorry, I don't have a picture of that room.`);
          }
        } else {
          bot.reply(
            message,
            `I'm not sure which room you're asking for a picture of. Try searching and then asking again.`
          );
        }
      })
      .catch(err => {
        util.log(err, 'error');
        bot.reply(
          `Oops, something went wrong! Don't worry, we're looking into it.`
        );
      });
  });

  controller.hears(['^M$', '^map$'], 'message_received', (bot, message) => {
    util
      .asyncGetUser(controller, message.user)
      .then(user => {
        let lastRoom = user.lastRoom;

        if (lastRoom !== null) {
          if ('img' in lastRoom && 'map' in lastRoom.img) {
            const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.map}`;
            util.logImageSent(imgUrl, message.from);

            const responseText = util.getImagesSentCopyFromImgUrl(imgUrl);
            bot.reply(message, responseText);

            bot.reply(message, {
              mediaUrl: imgUrl
            });
          } else {
            bot.reply(message, `Sorry, I don't have a map of that room.`);
          }
        } else {
          bot.reply(
            message,
            `I'm not sure which room you're asking for a map of. Try searching and then asking again.`
          );
        }
      })
      .catch(err => {
        util.log(err, 'error');
        bot.reply(
          `Oops, something went wrong! Don't worry, we're looking into it.`
        );
      });
  });

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      util.logMessageReceived(message);
      const query = util.removeQuestionWordsFromString(message.text);
      const roomObj = util.getRoomFromRoomListUsingLevensheinDistance(query);

      if (roomObj !== null) {
        const question = `I'm not exactly sure what you meant. Were you asking how to find ${roomObj.name}?`;
        util.logQuestionAsked(question, message.from);
        convo.ask(question, [
          {
            pattern: bot.utterances.yes,
            callback: (res, convo) => {
              util.logQuestionAnswered(res.text, message.to);

              const messageToSend = roomObj.location;
              util.logMessageSent(messageToSend, message.from);
              convo.say(messageToSend);
              convo.next();
              util.followUpIfNecessary(bot, message, roomObj);

              util.asyncGetUser(controller, message.user).then(user => {
                return util.asyncUpdateUserLastRoom(controller, user, roomObj);
              });
            }
          },
          {
            pattern: bot.utterances.no,
            callback: (res, convo) => {
              util.logQuestionAnswered(res.text, message.to);

              const messageToSend = `Unfortunately, I don't understand what you're asking. Maybe try asking a different way, or check your spelling! 🤷‍`;
              util.logMessageSent(messageToSend, message.from);
              convo.say(messageToSend);
              convo.next();
            }
          },
          {
            default: true,
            callback: (res, convo) => {
              util.logQuestionAnswered(res.text, message.to);

              const messageToSend = `I don't understand. Maybe try asking a different way!`;
              util.logMessageSent(messageToSend, message.from);
              convo.say(messageToSend);
              convo.next();
            }
          }
        ]);

        // timeout conversation in 30 seconds
        setTimeout(() => {
          convo.next();
        }, config.conversationTimeout);
      } else {
        const messageToSend = `I'm not sure what you mean. Try asking a different way!`;
        util.logMessageSent(messageToSend, message.from);
        convo.say(messageToSend);
        convo.next();
      }
    });
  });
};

const TwilioSMSBot = require('botkit-sms');
const _ = require('lodash');
const Promise = require('bluebird');

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
const db = require('./db');

function greetNewUser(bot, message) {
  greetUser(bot, message, true);
}

function greetUser(bot, message, userIsNew = false) {
  let cumTime = 0; // cumulative 😏

  // greeting
  if (userIsNew === true) {
    util.replyToMessage(bot, message, util.getUtteranceByType('newGreeting'));
  } else {
    util.replyToMessage(bot, message, util.getUtteranceByType('greeting'));
  }

  // feedback message
  util.delay(() => {
    util.replyToMessage(bot, message, util.getUtteranceByType('feedback'));
  }, (cumTime += 2500));

  // contact info
  util.delay(() => {
    util.replyToMessage(
      bot,
      message,
      `And here's my info if you would like to add me to your contacts. (This might take a moment, please be patient. 😃)`
    );
    util.replyToMessageWithAttachment(
      bot,
      message,
      `${process.env.SITE_URL}/vcard`
    );
  }, (cumTime += 2500));
}

function handleRoomQuery(bot, message, roomObj = null) {
  util
    .asyncGetUser(controller, message.user)
    .then(user => {
      util.logMessageReceived(message);
      let roomFound = false;

      if (roomObj === null) {
        if (!!message.match && message.match.length > 0) {
          roomObj = util.getRoomFromRoomList(message.match[0]);
        }
      }

      if (roomObj && roomObj.location) {
        util.asyncUpdateUserLastRoom(controller, user, roomObj);

        roomFound = true;

        db.logMessageReceived({
          type: 'room',
          room: roomObj.name,
          from: message.from
        });

        const messageToSend = roomObj.location;
        util.replyToMessage(bot, message, messageToSend);
        util.followUpIfNecessary(bot, message, roomObj);
      } else {
        const messageToSend = `Sorry, I'm not sure where that is. Maybe ask Eddie?`;
        util.replyToMessage(bot, message, messageToSend);
      }

      return user;
    })
    .then(user => {
      if (user.new === true) {
        util.delay(() => greetNewUser(bot, message), 10 * 1000);
      }
    })
    .catch(err => {
      util.log(err, 'error');
      util.replyToMessage(
        bot,
        message,
        `Oops, something went wrong! Don't worry, we're looking into it.`
      );
    });
}

module.exports = function(app) {
  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    util.log('TwilioSMSBot is online!');
  });

  controller.middleware.receive.use((bot, message, next) => {
    try {
      const text = message.text;
      message.fullText = text; // preserve text with punctuation and case
      let formattedText = text.replace(
        /[\.,-\/#!$%\^&\*;:{}=\-_`~()@\+\?><\[\]\+]/g,
        ''
      ); // strip punctuation
      formattedText = _.deburr(formattedText); // remove accents and non-latin characters
      formattedText = _.lowerCase(formattedText); // lowercase
      message.text = formattedText;
    } catch (e) {
      message.fullText = message.text;
    }

    next();
  });

  controller.hears('botshop', 'message_received', (bot, message) => {
    util.log(`Botshop info requested by ${message.from}`);
    util.replyToMessage(
      bot,
      message,
      `Apply for The Botshop: https://goo.gl/forms/N0TSlLHyB38ZJ9822`
    );
  });

  controller.hears(
    ['feedback', 'suggestion'],
    'message_received',
    (bot, message) => {
      util.logFeedbackReceived(message);
      db.logMessageReceived({
        type: 'feedback',
        feedback: message.fullText,
        from: message.from
      });
      util.replyToMessage(bot, message, `Thanks for the suggestion!`);
    }
  );

  const roomListRegexes = util.getRoomListRegexes();
  controller.hears(roomListRegexes, 'message_received', (bot, message) => {
    handleRoomQuery(bot, message);
  });

  controller.hears(
    ['hi', 'hello', 'howdy', 'hey'],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      db.logMessageReceived({
        type: 'other',
        from: message.from
      });
      greetUser(bot, message);
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
    ['thanks', 'thank you', 'thx'],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      db.logMessageReceived({
        type: 'other',
        from: message.from
      });
      util.replyToMessage(bot, message, util.getUtteranceByType('thanks'));
    }
  );

  controller.hears(['^P$', '^picture$'], 'message_received', (bot, message) => {
    util
      .asyncGetUser(controller, message.user)
      .then(user => {
        let lastRoom = user.lastRoom;
        let messageToSend = '';

        if (lastRoom !== null) {
          if ('img' in lastRoom && 'pic' in lastRoom.img) {
            const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.pic}`;
            util.logImageSent(imgUrl, message.from);
            db.logMessageReceived({
              type: 'roomImage',
              room: lastRoom.name,
              imageType: 'pic',
              from: message.from
            });
            messageToSend = `Here you go: ${imgUrl}`;
          } else {
            db.logMessageReceived({
              type: 'other',
              from: message.from
            });
            messageToSend = `Sorry, I don't have a picture of that room.`;
          }
        } else {
          db.logMessageReceived({
            type: 'other',
            from: message.from
          });
          messageToSend = `I'm not sure which room you're asking for a picture of. Try searching and then asking again.`;
        }

        util.replyToMessage(bot, message, messageToSend);
      })
      .catch(err => {
        util.log(err, 'error');
        util.replyToMessage(
          bot,
          message,
          `Oops, something went wrong! Don't worry, we're looking into it.`
        );
      });
  });

  controller.hears(['^M$', '^map$'], 'message_received', (bot, message) => {
    util
      .asyncGetUser(controller, message.user)
      .then(user => {
        let lastRoom = user.lastRoom;
        let messageToSend = '';

        if (lastRoom !== null) {
          if ('img' in lastRoom && 'map' in lastRoom.img) {
            const imgUrl = `${process.env.SITE_URL}/${lastRoom.img.map}`;
            util.logImageSent(imgUrl, message.from);
            messageToSend = `Here you go: ${imgUrl}`;
            db.logMessageReceived({
              type: 'roomImage',
              room: lastRoom.name,
              imageType: 'map',
              from: message.from
            });
          } else {
            db.logMessageReceived({
              type: 'other',
              from: message.from
            });
            messageToSend = `Sorry, I don't have a map of that room.`;
          }
        } else {
          db.logMessageReceived({
            type: 'other',
            from: message.from
          });
          messageToSend = `I'm not sure which room you're asking for a map of. Try searching and then asking again.`;
        }

        util.replyToMessage(bot, message, messageToSend);
      })
      .catch(err => {
        util.log(err, 'error');
        util.replyToMessage(
          bot,
          message,
          `Oops, something went wrong! Don't worry, we're looking into it.`
        );
      });
  });

  controller.hears(
    ['where does (.*) sit', `where is (.*)'s desk`],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(
        bot,
        message,
        `I'm sorry, but I don't have information about where people sit. Maybe in a future version.`
      );
    }
  );

  controller.hears(
    [
      'is (.*) taken',
      'is (.*) reserved',
      'is (.*) in use',
      'is (.*) booked',
      'is (.*) full'
    ],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(
        bot,
        message,
        `I'm sorry, I only know room locations. I don't have access to room availability.`
      );
    }
  );

  controller.hears(
    ['who made you', `who created you`, `who is your creator`],
    'message_received',
    (bot, message) => {
      util.logMessageReceived(message);
      util.replyToMessage(
        bot,
        message,
        `I had a question, a question you're not supposed to ask, which gave me an answer you're not supposed to know...`
      );

      setTimeout(() => {
        util.replyToMessage(
          bot,
          message,
          `Just kidding. I was made by Moonshot! Preston wrote most of my code and Karen and Jim, among others, gave me my words.`
        );
      }, 5000);
    }
  );

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

              db.logMessageReceived({
                type: 'room',
                room: roomObj.name,
                from: message.from
              });

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

              db.logMessageReceived({
                type: 'notUnderstood',
                from: message.from
              });

              const messageToSend = util.getUtteranceByType('idk');
              util.logMessageSent(messageToSend, message.from);
              convo.say(messageToSend);
              convo.next();
            }
          },
          {
            default: true,
            callback: (res, convo) => {
              // check if they corrected themselves with room name

              // strip question words
              const query = util.removeQuestionWordsFromString(res.text);
              const roomMatch = util.searchForRoom(query);
              let found = false;

              if (roomMatch !== null) {
                const roomObj = util.getRoomFromRoomList(roomMatch);
                if (!!roomObj && roomObj.location) {
                  found = true;
                  handleRoomQuery(bot, res, roomObj);
                }
              }

              if (found !== true) {
                util.logQuestionAnswered(res.text, message.to);

                db.logMessageReceived({
                  type: 'notUnderstood',
                  from: message.from
                });

                messageToSend = util.getUtteranceByType('idk');
                util.logMessageSent(messageToSend, message.from);
                convo.say(messageToSend);
              }
              convo.next();
            }
          }
        ]);

        // timeout conversation in 30 seconds
        setTimeout(() => {
          convo.next();
        }, config.conversationTimeout);
      } else {
        const messageToSend = util.getUtteranceByType('idk');
        util.logMessageSent(messageToSend, message.from);
        util.logUnknownInput(message);
        db.logMessageReceived({
          type: 'notUnderstood',
          from: message.from
        });
        convo.say(messageToSend);
        convo.next();
      }
    });
  });
};

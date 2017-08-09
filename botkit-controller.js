const TwilioSMSBot = require('botkit-sms');
const controller = TwilioSMSBot({
  account_sid: process.env.TWILIO_ACCOUNT_SID,
  auth_token: process.env.TWILIO_AUTH_TOKEN,
  twilio_number: process.env.TWILIO_NUMBER
});

module.exports = function(app) {
  let bot = controller.spawn({});

  controller.createWebhookEndpoints(app, bot, function() {
    controller.startTicking();
    console.log('TwilioSMSBot is online!');
  });

  controller.hears(['hi', 'hello'], 'message_received', (bot, message) => {
    bot.startConversation(message, (err, convo) => {
      convo.say('Hi, I am Oliver, an SMS bot! :D');
      convo.ask('What is your name?', (res, convo) => {
        convo.say(`Nice to meet you, ${res.text}!`);
        convo.next();
      });
    });
  });

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.reply(message, 'huh?');
  });
};

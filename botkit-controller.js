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
    bot.reply(
      message,
      `Hi there! I'm Roombot, a tool made by Moonshot to help you find any room in the building. To use me, just ask, "Where's Uranus", for example.`
    );
  });

  controller.hears(
    ['thanks', 'thank you'],
    'message_received',
    (bot, message) => {
      bot.reply(message, `You're welcome!`);
    }
  );

  controller.hears('.*', 'message_received', (bot, message) => {
    bot.reply(message, `Sorry, not sure what you mean. Maybe ask Eddie?`);
  });
};

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    owners: process.env.BOT_OWNERS
  },
  ivao: {
    channels: {
      atc: process.env.ATC_CHANNEL,
      pilot: process.env.PILOT_CHANNEL
    }
  },
  environment: process.env.NODE_ENV
};

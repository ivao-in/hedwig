module.exports = {
  environment: process.env.NODE_ENV,
  host: process.env.HOST,
  port: 5000,
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    owners: process.env.BOT_OWNERS
  },
  ivao: {
    server: process.env.IVAO_SERVER,
    channels: {
      atc: process.env.ATC_CHANNEL,
      pilot: process.env.PILOT_CHANNEL,
      atcHallOfFame: process.env.ATC_HALL_OF_FAME_CHANNEL,
      memberJoin: process.env.MEMBER_JOIN_CHANNEL,
      staff: process.env.STAFF_CHANNEL
    }
  },
  jwt: {
    secret: process.env.JWT_SECRET
  }
};

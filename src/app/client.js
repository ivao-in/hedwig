const path = require('path');
const { CommandoClient } = require('discord.js-commando');

const services = require('../config/services');
const logger = require('./utils/Logger');

const client = new CommandoClient({
  commandPrefix: '!',
  owner: services.discord.owners,
  invite: services.discord.supportServerInvite,
  nonCommandEditable: true
});

client.registry
  .registerDefaultTypes()
  .registerGroups([
    ['util', 'Utility commands'],
    ['admin', 'Admin commands'],
    ['atc', 'ATC commands'],
    ['pilot', 'Pilot commands']
  ])
  .registerCommandsIn(path.join(__dirname, 'commands'));

client.once('ready', async () => {
  logger.info(`Logged in as ${client.user.tag}! (${client.user.id})`);

  // client.user.setActivity({
  //   type: 'WATCHING',
  //   name: `in.ivao.aero`
  // });
});

client.on('error', (error) => logger.error(error));

client.login(services.discord.token);

module.exports = client;

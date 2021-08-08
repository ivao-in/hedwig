const fs = require('fs');
const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');

const logger = require('../../utils/Logger');

module.exports = class ResetPilotCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'reset-pilot',
      group: 'pilot',
      memberName: 'reset-pilot',
      aliases: ['rp'],
      description: 'Resets the pilot data',
      examples: ['reset-pilot', 'rp'],
      ownerOnly: true
    });
  }

  async run(msg) {
    fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify({}));
    fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify({}));
    logger.info(`Pilot reset done!`);

    const donateEmbed = new MessageEmbed()
      .setTitle('Reset')
      .setColor('#1A8FE3')
      .setDescription('Pilot data has been reset')
      .setFooter(this.client.user.username)
      .setTimestamp();

    (await msg.embed(donateEmbed)).delete({
      timeout: 10000,
    }).then(() => msg.delete());
  }
};

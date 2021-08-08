const fs = require('fs');
const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');

const logger = require('../../utils/Logger');

module.exports = class ResetAtcCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'reset-atc',
      group: 'atc',
      memberName: 'reset-atc',
      aliases: ['ra'],
      description: 'Resets the atc data',
      examples: ['reset-atc', 'ra'],
      ownerOnly: true
    });
  }

  async run(msg) {
    fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify({}));
    logger.info(`ATC reset done!`);

    const donateEmbed = new MessageEmbed()
      .setTitle('Reset')
      .setColor('#1A8FE3')
      .setDescription('ATC data has been reset')
      .setFooter(this.client.user.username)
      .setTimestamp();

    (await msg.embed(donateEmbed)).delete({
      timeout: 10000,
    }).then(() => msg.delete());
  }
};

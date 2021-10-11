const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');

const logger = require('../../utils/Logger');

dayjs.extend(utc);

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
    const now = dayjs().utc();
    fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify({}));
    let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
    data = JSON.parse(data);
    data.atc = now;
    fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');
    logger.info(`ATC reset done!`);

    const resetAtcEmbed = new MessageEmbed()
      .setTitle('Reset')
      .setColor('#1A8FE3')
      .setDescription('ATC data has been reset')
      .setFooter(this.client.user.username)
      .setTimestamp();

    (await msg.embed(resetAtcEmbed))
      .delete({
        timeout: 10000
      })
      .catch((error) => {
        logger.error(error);
      })
      .finally(() => {
        msg.delete().catch((error) => {
          logger.error(error);
        });
      });
  }
};

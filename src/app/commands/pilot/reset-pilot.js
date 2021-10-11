const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');

const logger = require('../../utils/Logger');

dayjs.extend(utc);

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
    const now = dayjs().utc();
    fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify({}));
    fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify({}));
    let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
    data = JSON.parse(data);
    data.pilot_departing = now;
    data.pilot_arriving = now;
    fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');
    logger.info(`Pilot reset done!`);

    const resetPilotEmbed = new MessageEmbed()
      .setTitle('Reset')
      .setColor('#1A8FE3')
      .setDescription('Pilot data has been reset')
      .setFooter(this.client.user.username)
      .setTimestamp();

    (await msg.embed(resetPilotEmbed))
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

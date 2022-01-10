/* eslint-disable no-await-in-loop */
const { MessageEmbed } = require('discord.js');
const { Command } = require('discord.js-commando');
const services = require('../../../config/services');

const logger = require('../../utils/Logger');

module.exports = class ResetAtcCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'prune',
      group: 'admin',
      memberName: 'prune',
      aliases: [],
      description: 'Prune all member roles and nicknames',
      examples: ['prune'],
      ownerOnly: true
    });
  }

  async run(msg) {

    logger.info('prune');

    const guild = await this.client.guilds.fetch(services.ivao.server);
    const members = await (await guild.members.fetch()).array();

    logger.info(members.length);

    logger.info(`Guild owner: ${guild.owner.id}`);

    for (let i = 0; i < members.length; i += 1) {
      const member = members[i];
      logger.info(`[${i + 1}/${members.length}] Member: ${member.id}. Is owner: ${member.id === guild.owner.id}. Is bot: ${member.user.bot}`);
      if (member.id !== guild.owner.id && !member.user.bot) {
        if (member.roles.cache.some(role => role.name === 'IN Staff')) {
          logger.info(`[${i + 1}/${members.length}] Member: ${member.id}. Is owner: ${member.id === guild.owner.id}. Is bot: ${member.user.bot}. Has role IN Staff. Skipping.`);
          // eslint-disable-next-line no-continue
          continue;
        }
        try {
          await member.setNickname(null);
          await member.roles.set([]);
          logger.info(`${member.id} ${member.user.username} pruned`);
        } catch (error) {
          logger.error(`Error pruning member ${member.id} ${member.user.username}`);
          logger.error(error);
        }
      }
    }

    const embed = new MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Prune')
      .setDescription('All member roles and nicknames have been reset.');

    return msg.embed(embed);
  }
}
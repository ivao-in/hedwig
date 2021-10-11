const fs = require('fs');
const { MessageEmbed } = require('discord.js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const NodeCache = require('node-cache');
const logger = require('./Logger');
const client = require('../client');
const services = require('../../config/services');

dayjs.extend(utc);

const atcCache = new NodeCache({ stdTTL: 24 * 60 * 60 });
atcCache.flushAll();

const atcHallOfFameCache = new NodeCache({ stdTTL: 24 * 60 * 60 });
atcHallOfFameCache.flushAll();

const objectsEqual = (o1, o2) =>
  typeof o1 === 'object' && Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length && Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
    : o1 === o2;

const arraysEqual = (a1, a2) =>
  a1 && a2 && a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx])) && a2.every((o, idx) => objectsEqual(o, a1[idx]));

const getOnlineAtc = () => {
  let data = fs.readFileSync(`${process.cwd()}/data/atc.json`, 'utf8');
  data = JSON.parse(data);
  const onlineAtc = [];

  Object.keys(data).forEach((key) => {
    if (data[key].online) {
      onlineAtc.push({ vid: key, ...data[key] });
    }
  });

  return onlineAtc
    .map((a) => ({
      vid: a.vid,
      lastCallsign: a.lastCallsign,
      lastFrequency: a.lastFrequency
    }))
    .sort((a, b) => {
      if (a.lastCallsign > b.lastCallsign) {
        return 1;
      } else if (a.lastCallsign < b.lastCallsign) {
        return -1;
      } else {
        return 0;
      }
    });
};

const getHallOfFameAtc = () => {
  let data = fs.readFileSync(`${process.cwd()}/data/atc.json`, 'utf8');
  data = JSON.parse(data);
  const hallOfFameAtc = [];

  Object.keys(data).forEach((key) => {
    hallOfFameAtc.push({ vid: key, ...data[key] });
  });

  return hallOfFameAtc
    .map((a) => ({
      vid: a.vid,
      minutes: Math.floor((a.milliseconds + a.lastSession) / 60000)
    }))
    .sort((a, b) => {
      if (a.minutes > b.minutes) {
        return -1;
      } else if (a.minutes < b.minutes) {
        return 1;
      } else {
        return 0;
      }
    })
    .slice(0, 10);
};

const hallOfFameHandler = async () => {
  const now = dayjs().utc();

  const atcHallOfFameChannel = await client.channels.fetch(services.ivao.channels.atcHallOfFame);
  if (!atcHallOfFameChannel) {
    logger.error('Could not find ATC Hall of Fame channel');
    return;
  }

  let metadata = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
  metadata = JSON.parse(metadata);

  const messages = (await atcHallOfFameChannel.messages.fetch()).array();

  const cacheValue = atcHallOfFameCache.get('in');

  const atcHallOfFameList = getHallOfFameAtc();

  if (messages?.length === 1 && arraysEqual(cacheValue, atcHallOfFameList)) {
    const existingMessage = messages[0].embeds[0];

    existingMessage.setFooter(
      `${client.user.username} • Data since ${dayjs.utc(metadata.atc).format('DD MMM HH:mmz')} • Updated at ${now.format('HH:mmz')}`
    );

    messages[0].edit(existingMessage);

    return;
  }

  messages.forEach((message) => {
    if (message.deletable) {
      message.delete();
    }
  });

  if (atcHallOfFameList.length === 0 || atcHallOfFameList[0].minutes === 0) {
    const atcHallOfFameEmbed = new MessageEmbed()
      .setTitle(`🏆 ATC Hall of Fame 🏆`)
      .setColor('#A1ADEE')
      .setDescription(`Not enough ATCs data available.`)
      .setFooter(`${client.user.username} • Data since ${dayjs.utc(metadata.atc).format('DD MMM HH:mmz')} • Updated at ${now.format('HH:mmz')}`);

    await atcHallOfFameChannel.send(atcHallOfFameEmbed);
  } else {
    const ranks = [':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:', ':keycap_ten:'];

    const description = atcHallOfFameList
      .filter((a) => a.minutes > 0)
      .map(
        (a, i) =>
          `${ranks[i]} **[${a.vid}](https://www.ivao.aero/Member.aspx?Id=${a.vid})** | ${Math.floor(a.minutes / 60)} hrs ${a.minutes % 60} mins`
      )
      .join('\n');
    const atcHallOfFameEmbed = new MessageEmbed()
      .setTitle(`🏆 ATC Hall of Fame 🏆`)
      .setColor('#A1ADEE')
      .setDescription(`${description}`)
      .setFooter(`${client.user.username} • Data since ${dayjs.utc(metadata.atc).format('DD MMM HH:mmz')} • Updated at ${now.format('HH:mmz')}`);

    await atcHallOfFameChannel.send(atcHallOfFameEmbed);
  }

  atcHallOfFameCache.set('in', atcHallOfFameList);
};

const atcHandler = async () => {
  const now = dayjs().utc();

  const atcChannel = await client.channels.fetch(services.ivao.channels.atc);
  if (!atcChannel) {
    logger.error('Could not find ATC channel');
    return;
  }

  const messages = (await atcChannel.messages.fetch()).array();

  const cacheValue = atcCache.get('in');

  const atcList = getOnlineAtc();

  if (messages?.length > 0 && arraysEqual(cacheValue, atcList)) {
    messages.forEach((message) => {
      const existingMessage = message.embeds[0];

      existingMessage
        .setTitle(`Online ATC (India) | ${now.format('DD MMM, HH:mmz')}`)
        .setFooter(`${client.user.username} • ${existingMessage.footer.text.split(' • ')[1]} • Updated at ${now.format('HH:mmz')}`);

      message.edit(existingMessage);
    });

    return;
  }

  messages.forEach((message) => {
    if (message.deletable) {
      message.delete();
    }
  });

  if (atcList?.length === 0) {
    const atcEmbed = new MessageEmbed()
      .setTitle(`Online ATC (India) | ${now.format('DD MMM, HH:mmz')}`)
      .setColor('#A1ADEE')
      .setURL('https://webeye.ivao.aero/')
      .setFooter(client.user.username)
      .setDescription('No ATC are online right now');

    await atcChannel.send(atcEmbed.setFooter(`${client.user.username} • Message 1 of 1 • Updated at ${now.format('HH:mmz')}`));
  } else {
    const embeds = [];

    let atcEmbed = new MessageEmbed()
      .setTitle(`Online ATC (India) | ${now.format('DD MMM, HH:mmz')}`)
      .setColor('#A1ADEE')
      .setURL('https://webeye.ivao.aero/')
      .setFooter(client.user.username);

    let desc = '';

    atcList.forEach((atc) => {
      if (desc.length > 900) {
        atcEmbed.setDescription(desc);
        embeds.push(atcEmbed);
        atcEmbed = new MessageEmbed()
          .setTitle(`Online ATC (India) | ${now.format('DD MMM, HH:mmz')}`)
          .setColor('#A1ADEE')
          .setURL('https://webeye.ivao.aero/')
          .setFooter(client.user.username);

        desc = '';
      }

      desc += `*${atc.vid}* | **${atc.lastCallsign}** [${atc.lastFrequency}]`;
      desc += '\n';
    });

    atcEmbed.setDescription(desc);

    embeds.push(atcEmbed);

    for (let i = 0; i < embeds.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await atcChannel.send(
        embeds[i].setFooter(`${client.user.username} • Message ${i + 1} of ${embeds.length} • Updated at ${now.format('HH:mmz')}`)
      );
    }
  }

  atcCache.set('in', atcList);
};

module.exports = { atcHandler, hallOfFameHandler };

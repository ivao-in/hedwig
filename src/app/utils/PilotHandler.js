const fs = require('fs');
const { MessageEmbed } = require('discord.js');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const NodeCache = require('node-cache');
const logger = require('./Logger');
const client = require('../client');
const services = require('../../config/services');

dayjs.extend(utc);

const pilotCache = new NodeCache({ stdTTL: 24 * 60 * 60 });
pilotCache.flushAll();

const objectsEqual = (o1, o2) =>
  typeof o1 === 'object' && Object.keys(o1).length > 0
    ? Object.keys(o1).length === Object.keys(o2).length && Object.keys(o1).every((p) => objectsEqual(o1[p], o2[p]))
    : o1 === o2;

const arraysEqual = (a1, a2) =>
  a1 && a2 && a1.length === a2.length && a1.every((o, idx) => objectsEqual(o, a2[idx])) && a2.every((o, idx) => objectsEqual(o, a1[idx]));

const getOnlinePilots = (type) => {
  if (type !== 'departing' && type !== 'arriving') {
    return;
  }

  let data;

  if (type === 'departing') {
    data = fs.readFileSync(`${process.cwd()}/data/pilot_departing.json`, 'utf8');
  } else if (type === 'arriving') {
    data = fs.readFileSync(`${process.cwd()}/data/pilot_arriving.json`, 'utf8');
  }

  data = JSON.parse(data);

  const onlinePilot = [];

  Object.keys(data).forEach((key) => {
    if (data[key].online) {
      onlinePilot.push({ vid: key, ...data[key] });
    }
  });

  // eslint-disable-next-line consistent-return
  return onlinePilot
    .map((a) => ({
      vid: a.vid,
      lastCallsign: a.lastCallsign,
      lastDepartureAerodrome: a.lastDepartureAerodrome,
      lastDestinationAerodrome: a.lastDestinationAerodrome
    }))
    .sort((a, b) => {
      if (type === 'departing') {
        if (a.lastDepartureAerodrome > b.lastDepartureAerodrome) {
          return 1;
        } else if (a.lastDepartureAerodrome < b.lastDepartureAerodrome) {
          return -1;
        } else {
          return 0;
        }
      } else if (type === 'arriving') {
        if (a.lastDestinationAerodrome > b.lastDestinationAerodrome) {
          return 1;
        } else if (a.lastDestinationAerodrome < b.lastDestinationAerodrome) {
          return -1;
        } else {
          return 0;
        }
      }
      return 0;
    });
};

const pilotHandler = async () => {
  const now = dayjs().utc();

  const pilotChannel = await client.channels.fetch(services.ivao.channels.pilot);
  if (!pilotChannel) {
    logger.error('Could not find Pilot channel');
    return;
  }

  const messages = (await pilotChannel.messages.fetch()).array();

  const cacheValue = pilotCache.get('in');

  const pilotList = {
    departing: getOnlinePilots('departing'),
    arriving: getOnlinePilots('arriving')
  };

  if (
    messages?.length > 0 &&
    cacheValue &&
    arraysEqual(cacheValue.departing, pilotList.departing) &&
    arraysEqual(cacheValue.arriving, pilotList.arriving)
  ) {
    messages.forEach((message) => {
      const existingMessage = message.embeds[0];

      existingMessage
        .setTitle(`${existingMessage.title.split(' | ')[0]} | ${now.format('DD MMM, HH:mmz')}`)
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

  if (pilotList.departing?.length === 0 && pilotList.arriving?.length === 0) {
    const pilotEmbed = new MessageEmbed()
      .setTitle(`Online Pilots | ${now.format('DD MMM, HH:mmz')}`)
      .setColor('#A1ADEE')
      .setURL('https://webeye.ivao.aero/')
      .setFooter(client.user.username)
      .setDescription('No pilots are online right now');

    await pilotChannel.send(pilotEmbed.setFooter(`${client.user.username} • Message 1 of 1 • Updated at ${now.format('HH:mmz')}`));
  } else {
    const embeds = [];
    if (pilotList.departing?.length > 0) {
      let pilotEmbed = new MessageEmbed()
        .setTitle(`Online Pilots (Departing) | ${now.format('DD MMM, HH:mmz')}`)
        .setColor('#A1ADEE')
        .setURL('https://webeye.ivao.aero/')
        .setFooter(client.user.username);

      let desc = '';

      pilotList.departing.forEach((pilot) => {
        if (desc.length > 900) {
          pilotEmbed.setDescription(desc);
          embeds.push(pilotEmbed);
          pilotEmbed = new MessageEmbed()
            .setTitle(`Online Pilots (Departing) | ${now.format('DD MMM, HH:mmz')}`)
            .setColor('#A1ADEE')
            .setURL('https://webeye.ivao.aero/')
            .setFooter(client.user.username);

          desc = '';
        }

        desc += `*${pilot.vid}* | **[${pilot.lastCallsign}](https://webeye.ivao.aero/?callsign=${pilot.lastCallsign})** [${pilot.lastDepartureAerodrome} - ${pilot.lastDestinationAerodrome}]`;
        desc += '\n';
      });

      pilotEmbed.setDescription(desc);

      embeds.push(pilotEmbed);
    }
    if (pilotList.arriving?.length > 0) {
      let pilotEmbed = new MessageEmbed()
        .setTitle(`Online Pilots (Arriving) | ${now.format('DD MMM, HH:mmz')}`)
        .setColor('#A1ADEE')
        .setURL('https://webeye.ivao.aero/')
        .setFooter(client.user.username);

      let desc = '';

      pilotList.arriving.forEach((pilot) => {
        if (desc.length > 900) {
          pilotEmbed.setDescription(desc);
          embeds.push(pilotEmbed);
          pilotEmbed = new MessageEmbed()
            .setTitle(`Online Pilots (Arriving) | ${now.format('DD MMM, HH:mmz')}`)
            .setColor('#A1ADEE')
            .setURL('https://webeye.ivao.aero/')
            .setFooter(client.user.username);

          desc = '';
        }

        desc += `*${pilot.vid}* | **[${pilot.lastCallsign}](https://webeye.ivao.aero/?callsign=${pilot.lastCallsign})** [${pilot.lastDepartureAerodrome} - ${pilot.lastDestinationAerodrome}]`;
        desc += '\n';
      });

      pilotEmbed.setDescription(desc);

      embeds.push(pilotEmbed);
    }

    for (let i = 0; i < embeds.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await pilotChannel.send(
        embeds[i].setFooter(`${client.user.username} • Message ${i + 1} of ${embeds.length} • Updated at ${now.format('HH:mmz')}`)
      );
    }
  }

  pilotCache.set('in', pilotList);
};

module.exports = pilotHandler;

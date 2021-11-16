const cron = require('node-cron');
const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const AsyncLock = require('async-lock');

const { MessageEmbed } = require('discord.js');
const client = require('../app/client');
const logger = require('../app/utils/Logger');
const { downloadData } = require('../app/utils/Ivao');
const { atcHandler, hallOfFameHandler, getHallOfFameAtc } = require('../app/utils/AtcHandler');
const pilotHandler = require('../app/utils/PilotHandler');
const services = require('./services');

dayjs.extend(utc);

client.on('ready', async () => {
  const lock = new AsyncLock();

  // Download data every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    lock.acquire('data', async () => {
      try {
        logger.info('Downloading whazzup data...');
        await downloadData();
        await pilotHandler();
        await atcHandler();
        await hallOfFameHandler();
        logger.info('Downloaded whazzup data.');
      } catch (err) {
        logger.error(err);
      }
    });
  });
  // 0 0 1 * *
  // Reset the pilots and atc data at 00:00 on the first day of the month

  // 0 0 */1 * *
  // Reset the pilots and atc data at 00:00 every day
  cron.schedule('0 0 */1 * *', async () => {
    lock.acquire(
      'data',
      async () => {
        try {
          logger.info(`Resetting ATC/Pilot data...`);
          const now = dayjs().utc();

          const staffChannel = await client.channels.fetch(services.ivao.channels.staff);
          if (!staffChannel) {
            logger.error('Could not find staff channel');
            return;
          }

          let metadata = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
          metadata = JSON.parse(metadata);

          const atcHallOfFameList = getHallOfFameAtc();

          if (atcHallOfFameList.length === 0 || atcHallOfFameList[0].minutes === 0) {
            const atcHallOfFameEmbed = new MessageEmbed()
              .setTitle(`🏆 ATC Hall of Fame 🏆`)
              .setColor('#A1ADEE')
              .setDescription(`Not enough ATCs data available.`)
              .setFooter(`${client.user.username} • Data since ${dayjs.utc(metadata.atc).format('DD MMM, HH:mmz')}`);

            await staffChannel.send(atcHallOfFameEmbed);
          } else {
            const ranks = [':one:', ':two:', ':three:', ':four:', ':five:', ':six:', ':seven:', ':eight:', ':nine:', ':keycap_ten:'];

            const description = atcHallOfFameList
              .filter((a) => a.minutes > 0)
              .map(
                (a, i) =>
                  `${ranks[i]} **[${a.vid}](https://www.ivao.aero/Member.aspx?Id=${a.vid})** | ${Math.floor(a.minutes / 60)} hrs ${
                    a.minutes % 60
                  } mins`
              )
              .join('\n');
            const atcHallOfFameEmbed = new MessageEmbed()
              .setTitle(`🏆 ATC Hall of Fame 🏆`)
              .setColor('#A1ADEE')
              .setDescription(`${description}`)
              .setFooter(`${client.user.username} • Data since ${dayjs.utc(metadata.atc).format('DD MMM, HH:mmz')}`);

            await staffChannel.send(atcHallOfFameEmbed);
          }

          fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify({}));
          fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify({}));
          fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify({}));

          let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
          data = JSON.parse(data);

          data.atc = now;
          data.pilot_departing = now;
          data.pilot_arriving = now;

          fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');

          logger.info(`Cron reset ATC/Pilot data`);
        } catch (err) {
          logger.error(err);
        }
      },
      { skipQueue: true }
    );
  });
});

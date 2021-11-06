const cron = require('node-cron');
const fs = require('fs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const AsyncLock = require('async-lock');

const client = require('../app/client');
const logger = require('../app/utils/Logger');
const { downloadData } = require('../app/utils/Ivao');
const { atcHandler, hallOfFameHandler } = require('../app/utils/AtcHandler');
const pilotHandler = require('../app/utils/PilotHandler');

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

    // 0 0 1 * *
    // Reset the pilots and atc data at 00:00 on the first day of the month
    cron.schedule('*/3 * * * *', async () => {
      lock.acquire('data', async () => {
        try {
          logger.info(`Resetting ATC/Pilot data...`);
          const now = dayjs().utc();

          fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify({}));
          fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify({}));
          fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify({}));

          let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
          data = JSON.parse(data);

          data.atc = now;
          data.pilot_departing = now;
          data.pilot_arriving = now;

          fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');

          logger.info(`Reset ATC/Pilot data`);
        }
        catch (err) {
          logger.error(err);
        }
      }, { skipQueue: true });
    });
  });
});
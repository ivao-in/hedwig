const client = require('../app/client');
const logger = require('../app/utils/Logger');
const { downloadData } = require('../app/utils/Ivao');
const { atcHandler, hallOfFameHandler } = require('../app/utils/AtcHandler');
const pilotHandler = require('../app/utils/PilotHandler');

client.on('ready', async () => {
  client.setInterval(async () => {
    logger.info(`Downloading atc data`);
    await downloadData();
    await pilotHandler();
    await atcHandler();
    await hallOfFameHandler();
  }, 1000 * 60 * 3);

  await downloadData();
  await pilotHandler();
  await atcHandler();
  await hallOfFameHandler();
});

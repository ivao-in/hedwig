const client = require('../app/client');
const logger = require('../app/utils/Logger');
const { downloadData } = require('../app/utils/Ivao');
const atcHandler = require('../app/utils/AtcHandler');
const pilotHandler = require('../app/utils/PilotHandler');

client.on('ready', async () => {
  client.setInterval(async () => {
    logger.info(`Downloading atc data`);
    await downloadData();
    await atcHandler();
    await pilotHandler();
  }, 1000 * 60 * 3);

  await downloadData();
  await atcHandler();
  await pilotHandler();
});

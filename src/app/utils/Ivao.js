const axios = require('axios').default;
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const S = require('string');
const fs = require('fs');
const logger = require('./Logger');

dayjs.extend(utc);

const api = axios.create({
  baseURL: 'https://api.ivao.aero/getdata/whazzup/whazzup.txt',
  timeout: 10000
});

const ivao = {
  general: {},
  clients: {},
  airports: {},
  servers: {}
};

const atcCallsignRegex = /^V[AEIO][A-Z]{2}_[A-Z_]*$/;
// const atcCallsignRegex = /^[A-Z]{4}_[A-Z_]*$/;
const indianAirspaceRegex = /^V[AEIO][A-Z]{2}$/;

function formatDate(date) {
  return dayjs(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(8, 10)}:${date.slice(10, 12)}:${date.slice(12, 14)}Z`);
}

function storeAtcData(activeAtcs) {
  let data = fs.readFileSync(`${process.cwd()}/data/atc.json`, 'utf8');
  data = JSON.parse(data);

  activeAtcs.forEach((atc) => {
    if (data[atc.vid]) {
      if (data[atc.vid].online) {
        if (data[atc.vid].lastCallsign === atc.callsign) {
          if (atc.connectionMilliseconds < data[atc.vid].lastSession) {
            data[atc.vid].milliseconds += data[atc.vid].lastSession;
          }
          data[atc.vid].lastSession = atc.connectionMilliseconds;
        } else {
          data[atc.vid].milliseconds += data[atc.vid].lastSession;
          data[atc.vid].lastSession = atc.connectionMilliseconds;
          data[atc.vid].lastCallsign = atc.callsign;
          data[atc.vid].lastFrequency = atc.frequency;
        }
      } else {
        logger.info(`${atc.vid} [${atc.callsign}] connected!`);
        data[atc.vid].lastSession = atc.connectionMilliseconds;
        data[atc.vid].lastCallsign = atc.callsign;
        data[atc.vid].lastFrequency = atc.frequency;
        data[atc.vid].online = true;
      }
    } else {
      logger.info(`${atc.vid} [${atc.callsign}] connected!`);
      data[atc.vid] = {
        milliseconds: 0,
        lastSession: atc.connectionMilliseconds,
        lastCallsign: atc.callsign,
        lastFrequency: atc.frequency,
        online: true
      };
    }
  });

  Object.keys(data).forEach((key) => {
    let found = false;
    activeAtcs.forEach((atc) => {
      if (atc.vid === key) {
        found = true;
      }
    });

    if (!found && data[key].online === true) {
      logger.info(`${key} [${data[key].lastCallsign}] disconnected!`);
      data[key].milliseconds += data[key].lastSession;
      data[key].lastSession = 0;
      data[key].lastCallsign = '';
      data[key].lastFrequency = '';
      data[key].online = false;
    }
  });

  fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify(data), 'utf8');

  logger.info(`ATC Data updated!`);
}

function storePilotData(activePilots, type) {
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

  activePilots.forEach((pilot) => {
    if (data[pilot.vid]) {
      if (data[pilot.vid].online) {
        if (
          data[pilot.vid].lastCallsign === pilot.callsign &&
          data[pilot.vid].lastDepartureAerodrome === pilot.departureAerodrome &&
          data[pilot.vid].lastDestinationAerodrome === pilot.destinationAerodrome
        ) {
          if (pilot.connectionMilliseconds < data[pilot.vid].lastSession) {
            data[pilot.vid].milliseconds += data[pilot.vid].lastSession;
          }
          data[pilot.vid].lastSession = pilot.connectionMilliseconds;
        } else {
          data[pilot.vid].milliseconds += data[pilot.vid].lastSession;
          data[pilot.vid].lastSession = pilot.connectionMilliseconds;
          data[pilot.vid].lastCallsign = pilot.callsign;
          data[pilot.vid].lastDepartureAerodrome = pilot.departureAerodrome;
          data[pilot.vid].lastDestinationAerodrome = pilot.destinationAerodrome;
          data[pilot.vid].lastDepartureTime = pilot.departureTime;
        }
      } else {
        logger.info(`${pilot.vid} [${pilot.callsign}] connected!`);
        data[pilot.vid].lastSession = pilot.connectionMilliseconds;
        data[pilot.vid].lastCallsign = pilot.callsign;
        data[pilot.vid].lastDepartureAerodrome = pilot.departureAerodrome;
        data[pilot.vid].lastDestinationAerodrome = pilot.destinationAerodrome;
        data[pilot.vid].lastDepartureTime = pilot.departureTime;
        data[pilot.vid].online = true;
      }
    } else {
      logger.info(`${pilot.vid} [${pilot.callsign}] connected!`);
      data[pilot.vid] = {
        milliseconds: 0,
        lastSession: pilot.connectionMilliseconds,
        lastCallsign: pilot.callsign,
        lastDepartureAerodrome: pilot.departureAerodrome,
        lastDestinationAerodrome: pilot.destinationAerodrome,
        lastDepartureTime: pilot.departureTime,
        online: true
      };
    }
  });

  Object.keys(data).forEach((key) => {
    let found = false;
    activePilots.forEach((pilot) => {
      if (pilot.vid === key) {
        found = true;
      }
    });

    if (!found && data[key].online === true) {
      logger.info(`${key} [${data[key].lastCallsign}] disconnected!`);
      data[key].milliseconds += data[key].lastSession;
      data[key].lastSession = 0;
      data[key].lastCallsign = '';
      data[key].lastDepartureAerodrome = '';
      data[key].lastDestinationAerodrome = '';
      data[key].lastDepartureTime = '';
      data[key].online = false;
    }
  });

  if (type === 'departing') {
    fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify(data), 'utf8');
  } else if (type === 'arriving') {
    fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify(data), 'utf8');
  }

  logger.info(`Pilot (${type}) Data updated!`);
}

module.exports = class Ivao {
  static async downloadData() {
    const now = dayjs().utc();

    const [, general, clients, airports, servers] = (await api.get(null)).data.split(/!GENERAL|!CLIENTS|!AIRPORTS|!SERVERS/g).map((r) => r.trim());

    general.split('\n').forEach((g) => {
      const t = g.split('=').map((r) => r.trim());
      ivao.general[S(t[0]).replaceAll(' ', '_').s] = t[1];
    });

    servers.split('\n').forEach((s) => {
      const t = s.split(':').map((r) => r.trim());
      ivao.servers[t[0]] = {
        ip: t[1],
        location: t[2],
        name: t[3],
        clientConnectionsAllowed: t[4],
        maximumConnection: t[5]
      };
    });

    airports.split('\n').forEach((a) => {
      const t = a.split(':').map((r) => r.trim());
      ivao.airports[t[0]] = {
        icao: t[0],
        atis: t[1]
      };
    });

    const atcs = [];
    const departingPilots = [];
    const arrivingPilots = [];

    clients.split('\n').forEach((c) => {
      const t = c.split(':').map((r) => r.trim());

      if (t[3] === 'ATC' && t[0].match(atcCallsignRegex)) {
        const atc = {
          vid: t[1],
          callsign: t[0],
          frequency: t[4],
          connectionStartTime: new Date(formatDate(t[37])),
          connectionMilliseconds: new Date() - new Date(formatDate(t[37]))
        };
        atcs.push(atc);
      }

      if (t[3] === 'PILOT' && (t[11].match(indianAirspaceRegex) || t[13].match(indianAirspaceRegex))) {
        const pilot = {
          vid: t[1],
          callsign: t[0],
          departureAerodrome: t[11],
          destinationAerodrome: t[13],
          departureTime:
            t[22].length === 2
              ? `00:${t[22].substring(0, 2)}z`
              : t[22].length === 3
                ? `0${t[22].substring(0, 1)}:${t[22].substring(1, 3)}z`
                : `${t[22].substring(0, 2)}:${t[22].substring(2, 4)}z`,
          connectionStartTime: new Date(formatDate(t[37])),
          connectionMilliseconds: new Date() - new Date(formatDate(t[37]))
        };
        if (t[11].match(indianAirspaceRegex)) {
          departingPilots.push(pilot);
        }
        if (t[13].match(indianAirspaceRegex)) {
          arrivingPilots.push(pilot);
        }
      }
    });

    if (!fs.existsSync(`${process.cwd()}/data/metadata.json`)) {
      fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify({}), 'utf8');
    }

    if (!fs.existsSync(`${process.cwd()}/data/atc.json`)) {
      fs.writeFileSync(`${process.cwd()}/data/atc.json`, JSON.stringify({}));
      let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
      data = JSON.parse(data);
      data.atc = now;
      fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');
    }
    if (!fs.existsSync(`${process.cwd()}/data/pilot_departing.json`)) {
      fs.writeFileSync(`${process.cwd()}/data/pilot_departing.json`, JSON.stringify({}));
      let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
      data = JSON.parse(data);
      data.pilot_departing = now;
      fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');
    }
    if (!fs.existsSync(`${process.cwd()}/data/pilot_arriving.json`)) {
      fs.writeFileSync(`${process.cwd()}/data/pilot_arriving.json`, JSON.stringify({}));
      let data = fs.readFileSync(`${process.cwd()}/data/metadata.json`, 'utf8');
      data = JSON.parse(data);
      data.pilot_arriving = now;
      fs.writeFileSync(`${process.cwd()}/data/metadata.json`, JSON.stringify(data), 'utf8');
    }
    storeAtcData(atcs);
    storePilotData(departingPilots, 'departing');
    storePilotData(arrivingPilots, 'arriving');
  }
};

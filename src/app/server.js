/* eslint-disable no-unreachable */
const express = require('express');
const fetch = require('node-fetch');
const { nanoid } = require('nanoid');
const fs = require('fs');
const DiscordOauth2 = require('discord-oauth2');
const AsyncLock = require('async-lock');

const services = require('../config/services');
const client = require('./client');
const logger = require('./utils/Logger');

const app = express();

const users = {};

if (!fs.existsSync(`${process.cwd()}/data`)) {
  fs.mkdirSync(`${process.cwd()}/data`);
}

if (!fs.existsSync(`${process.cwd()}/data/users.json`)) {
  fs.writeFileSync(`${process.cwd()}/data/users.json`, JSON.stringify({}), 'utf8');
}

const lock = new AsyncLock();

const oauth = new DiscordOauth2({
  clientId: services.discord.clientId,
  clientSecret: services.discord.clientSecret,
  redirectUri: `${services.host}/discord/landing`
});

const staffRoles = {
  // DIVISION HQ
  'IN-DIR': '',
  'IN-ADIR': '',

  // Special Operation
  'IN-SOC': '730675406684028998',
  'IN-SOAC': '730675406684028998',

  // Flight Operations
  'IN-FOC': '730674599942946856',
  'IN-FOAC': '730674599942946856',

  // ATC Operations
  'IN-AOC': '730674367561859122',
  'IN-AOAC': '730674367561859122',

  // Training
  'IN-TC': '730675387646083095',
  'IN-TAC': '730675387646083095',
  'IN-TA1': '730675387646083095',
  'IN-TA2': '730675387646083095',

  // MEMBERSHIP
  'IN-MC': '730674117975605248',
  'IN-MAC': '730674117975605248',
  'IN-MA1': '730674117975605248',

  // EVENTS
  'IN-EC': '730674881292664863',
  'IN-EAC': '730674881292664863',
  'IN-EA1': '730674881292664863',
  'IN-EA2': '730674881292664863',
  'IN-EA3': '730674881292664863',

  // PUBLIC RELATIONS
  'IN-PRC': '730675118627356733',
  'IN-PRAC': '730675118627356733',

  // WEB DEVELOPMENT
  'IN-WM': '',
  'IN-AWM': '',
}


app.get('/', (request, response) => response.status(200).send('🚀'));

app.get('/discord', (request, response) => {
  response.redirect(`https://login.ivao.aero/index.php?url=${services.host}/ivao/landing`);
});

app.get('/ivao/landing', async (request, response) => {
  const ivaoToken = request.query.IVAOTOKEN;

  const oauthResult = await fetch(`https://login.ivao.aero/api.php?type=json&token=${ivaoToken}`);
  const user = await oauthResult.json();

  logger.info(JSON.stringify(user));

  if (!user || !user.vid) {
    return response.status(400).send('Unauthorized');
  }

  if (user.rating < 2) {
    return response.status(400).send('Your account is inactive or suspended from IVAO');
  }

  const state = nanoid(50);
  users[state] = user;

  logger.info(`${user.vid} taking off to Discord OAuth`);

  const url = oauth.generateAuthUrl({
    scope: ['identify', 'guilds', 'guilds.join'],
    state
  });

  return response.redirect(url);
});

app.get('/discord/landing', async (request, response) => {
  const { code, state } = request.query;
  if (!code || !state) {
    return response.status(400).send('Invalid Code');
  }
  const user = users[state];
  logger.info(`${user.vid} landing from Discord OAuth`);
  delete users[state];

  if (!user) {
    return response.status(400).send('Invalid State');
  }

  if (user.rating < 2) {
    return response.status(400).send('Your account is inactive or suspended from IVAO');
  }

  if (code) {
    try {
      const oauthResult = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams({
          client_id: services.discord.clientId,
          client_secret: services.discord.clientSecret,
          code,
          grant_type: 'authorization_code',
          scope: 'identify',
          redirect_uri: `${services.host}/discord/landing`
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const oauthData = await oauthResult.json();
      if (!oauthData.access_token) {
        return response.status(400).send('Invalid Code');
      }

      const userData = await oauth.getUser(oauthData.access_token);

      const userGuilds = await oauth.getUserGuilds(oauthData.access_token);
      const ivaoGuilds = userGuilds.filter((guild) => guild.id === services.ivao.server);

      const roles = [];
      let staffTitle = '';

      if (user.division === 'IN') {
        if (user.ratingatc > 1) {
          roles.push('445081680412278784');
        }

        if (user.ratingpilot > 1) {
          roles.push('445086612091830272');
        }

        if (user.staff) {
          roles.push('445099211395170304');

          const staffPositions = user.staff.split(':');
          const divisionStaffPositions = staffPositions.filter((position) => position.startsWith('IN-'));
          const hqStaffPositions = staffPositions.filter((position) => divisionStaffPositions.indexOf(position) === -1);

          if (hqStaffPositions.length > 0) {
            staffTitle = `${hqStaffPositions.join('/')}/`;
          } else if (divisionStaffPositions.length > 0) {
            staffTitle = `IN-${divisionStaffPositions.map((position) => position.substring(3)).join('/')}`;
          }

          roles.push(...(staffPositions.map((position) => staffRoles[position]).filter((position) => position)));
        }
      } else {
        roles.push('612571349558231070');
      }

      if (ivaoGuilds.length === 0) {
        lock.acquire('oauth', async () => {
          const userMapping = fs.readFileSync(`${process.cwd()}/data/users.json`, 'utf8');

          const userMappingData = JSON.parse(userMapping);

          if (userMappingData[user.vid]) {
            const guild = client.guilds.cache.get(services.ivao.server);
            const member = guild.members.cache.get(userMappingData[user.vid]);
            if (member) {
              member.kick('Linked new account');
            }
          } else {
            const res = await oauth.addMember({
              accessToken: oauthData.access_token,
              botToken: services.discord.token,
              guildId: services.ivao.server,
              userId: userData.id,
              nickname: `${user.vid} - ${user.firstname}`,
              roles
            });

            userMappingData[user.vid] = userData.id;

            const memberJoinChannel = await client.channels.fetch(services.ivao.channels.memberJoin);
            memberJoinChannel.send(`<@${userData.id}> welcome to the IVAO IN Official Discord Server! :ivao_in:`);
          }

          fs.writeFileSync(`${process.cwd()}/data/users.json`, JSON.stringify(userMappingData));
        });
      } else {
        // const ivaoGuild = ivaoGuilds[0];
        const guild = await client.guilds.fetch(services.ivao.server);
        const member = await guild.members.fetch(userData.id);
        await member.setNickname(`${staffTitle || user.vid} - ${user.firstname}`);
        const excludedRoles = (await member.roles.fetch()).filter((r) => ["Discord Manager", "Trainer", "Elite Pilot"].includes(r.name))
        await member.roles.set(roles);
        if (excludedRoles.length > 0) {
          await member.roles.add(excludedRoles);
        }
      }

      return response.redirect(`https://discord.com/channels/${services.ivao.server}/${services.ivao.channels.memberJoin}`);
    } catch (error) {
      return response.status(400).send('Unauthorized');
    }
  }

  return response.status(400).send('Unauthorized');

  // return response.send('You have successfully joined the IVAO IN Discord Server. You can now close this page and return to the Discord application.');
});

app.listen(services.port, () => logger.info(`App listening at PORT ${services.port}`));

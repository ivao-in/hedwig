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

  if (!user || !user.vid) {
    logger.error('Invalid IVAO token');
    return response.status(400).send('Unauthorized');
  }

  logger.info(`${user.vid} landing from IVAO SSO`);

  logger.info(`User Info: ${JSON.stringify(user)}`);

  if (user.rating < 2) {
    logger.info(`${user.vid} is inactive or suspended from IVAO`);
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
    logger.info('No code or state');
    return response.status(400).send('Invalid Code');
  }
  const user = users[state];
  logger.info(`${user.vid} landing from Discord OAuth`);
  delete users[state];

  if (!user) {
    logger.info(`${user.vid} no user found`);
    return response.status(400).send('Invalid State');
  }

  if (user.rating < 2) {
    logger.info(`${user.vid} is inactive or suspended from IVAO`);
    return response.status(400).send('Your account is inactive or suspended from IVAO');
  }

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

    const roles = [];
    let staffTitle = '';

    if (user.division === 'IN') {
      logger.info(`${user.vid} is in the IN division`);
      if (user.ratingatc > 1) {
        logger.info(`${user.vid} is an ATC (rating: ${user.ratingatc}, role: 445081680412278784)`);
        roles.push('445081680412278784');
      }

      if (user.ratingpilot > 1) {
        logger.info(`${user.vid} is a pilot (rating: ${user.ratingpilot}, role: 445086612091830272)`);
        roles.push('445086612091830272');
      }

      if (user.staff) {
        logger.info(`${user.vid} is a staff member (role: 445099211395170304)`);
        roles.push('445099211395170304');

        const staffPositions = user.staff.split(':');
        const divisionStaffPositions = staffPositions.filter((position) => position.startsWith('IN-'));
        logger.info(`${user.vid} has ${divisionStaffPositions.join(', ')} staff positions`);
        const hqStaffPositions = staffPositions.filter((position) => divisionStaffPositions.indexOf(position) === -1);
        logger.info(`${user.vid} has ${hqStaffPositions.length > 0 ? hqStaffPositions.join(', ') : 'no'} HQ staff positions`);

        if (hqStaffPositions.length > 0) {
          staffTitle = `${hqStaffPositions.join('/')}/`;
        } else if (divisionStaffPositions.length > 0) {
          staffTitle = `IN-${divisionStaffPositions.map((position) => position.substring(3)).join('/')}`;
        }
        logger.info(`${user.vid} has the following staff titles: ${staffTitle}`);

        const staffDiscordRoles = staffPositions.map((position) => staffRoles[position]).filter((position) => position);

        logger.info(`${user.vid} has the following staff roles: ${staffDiscordRoles.join(', ')}`);

        roles.push(...staffDiscordRoles);
      }
    } else {
      logger.info(`${user.vid} is not in the IN division (division: ${user.division}, role: 612571349558231070)`);
      roles.push('612571349558231070');
    }

    lock.acquire('oauth', async () => {
      const userMapping = fs.readFileSync(`${process.cwd()}/data/users.json`, 'utf8');

      const userMappingData = JSON.parse(userMapping);

      if (userMappingData[user.vid]) {
        logger.info(`${user.vid} already has a different Discord ID (${userMappingData[user.vid]}) in the server`);
        const guild = await client.guilds.fetch(services.ivao.server);
        const member = await guild.members.fetch(userMappingData[user.vid]);
        if (member) {
          try {
            await member.kick('Linked new account');
            logger.info(`${user.vid} kicked old account.`);
          } catch (error) {
            logger.error(`${user.vid} could not be kicked from the server: ${error}`);
          }
          delete userMappingData[user.vid];
        } else {
          logger.info(`${user.vid} could not be found in the server`);
        }
      }

      userMappingData[user.vid] = userData.id;

      const userGuilds = await oauth.getUserGuilds(oauthData.access_token);
      const ivaoGuilds = userGuilds.filter((guild) => guild.id === services.ivao.server);

      if (ivaoGuilds.length === 0) {
        logger.info(`${user.vid} is not in the IVAO server`);
        await oauth.addMember({
          accessToken: oauthData.access_token,
          botToken: services.discord.token,
          guildId: services.ivao.server,
          userId: userData.id,
          nickname: `${staffTitle || `${user.vid} -`} ${user.firstname}`,
          roles
        });

        logger.info(`${user.vid} added to Discord server`);

        const memberJoinChannel = await client.channels.fetch(services.ivao.channels.memberJoin);
        await memberJoinChannel.send(`<@${userData.id}> welcome to the IVAO IN Official Discord Server! : ivao_in: `);
      } else {
        logger.info(`${user.vid} is already in the IVAO server`);
        const guild = await client.guilds.fetch(services.ivao.server);
        const member = await guild.members.fetch(userData.id);
        await member.setNickname(`${staffTitle || `${user.vid} -`} ${user.firstname}`);
        logger.info(`${user.vid} nickname set to ${staffTitle || `${user.vid} -`} ${user.firstname}`);
        const excludedRoles = (await member.roles.cache.array()).filter((role) => ["Discord Manager", "Trainer", "Elite Pilot"].includes(role.name)).map((role) => role.id);
        logger.info(`${user.vid} excluded roles: ${excludedRoles} `);
        await member.roles.set(roles);
        logger.info(`${user.vid} roles set to ${roles} `);
        if (excludedRoles.length > 0) {
          await member.roles.add(excludedRoles);
          logger.info(`${user.vid} excluded roles added: ${excludedRoles} `);
        }
      }

      fs.writeFileSync(`${process.cwd()}/data/users.json`, JSON.stringify(userMappingData, null, 2), 'utf8');
    });

    return response.redirect(`https://discord.com/channels/${services.ivao.server}/${services.ivao.channels.memberJoin}`);
  } catch (error) {
    logger.error(error);
    return response.status(400).send('Unauthorized');
  }
});

app.listen(services.port, () => logger.info(`App listening at PORT ${services.port}`));

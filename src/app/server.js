const express = require('express');
const fetch = require('node-fetch');
const { nanoid } = require('nanoid');
const DiscordOauth2 = require('discord-oauth2');

const services = require('../config/services');
const client = require('./client');

const app = express();

const users = {};

const oauth = new DiscordOauth2({
  clientId: services.discord.clientId,
  clientSecret: services.discord.clientSecret,
  redirectUri: `${services.host}/discord/landing`
});

app.get('/discord/takeoff/:ivao_id', (req, res) => {
  const ivaoId = req.params.ivao_id;
  const state = nanoid(50);
  console.log(`[${ivaoId}] Taking off to Discord OAuth`);
  users[state] = ivaoId;

  const url = oauth.generateAuthUrl({
    scope: ['identify', 'guilds', 'guilds.join'],
    state
  });

  return res.redirect(url);
});

app.get('/discord/landing', async (request, response) => {
  const { code, state } = request.query;
  if (!code || !state) {
    return response.status(400).send('Invalid Code');
  }
  const vid = users[state];
  console.log(`[${vid}] Landing from Discord OAuth`);
  delete users[state];
  if (!vid) {
    return response.status(400).send('Invalid State');
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

      const userIvaoInfo = {
        vid: '578091',
        firstname: 'Rahul',
        lastname: 'Singh',
        pilotRating: 'FS1',
        atcRating: 'AS1',
        division: 'IN',
        elitePilot: true
      };

      const roles = [];

      if (userIvaoInfo.division === 'IN') {
        if (userIvaoInfo.elitePilot) {
          roles.push('887436190767251518');
        }

        if (['AS1', 'AS2', 'AS3'].indexOf(userIvaoInfo.atcRating) !== -1) {
          roles.push('887423386106601573');
        } else if (['ADC', 'APC', 'ACC', 'SEC', 'SAI', 'CAI'].indexOf(userIvaoInfo.atcRating) !== -1) {
          roles.push('887423326790746173');
        }

        if (['FS1', 'FS2', 'FS3'].indexOf(userIvaoInfo.pilotRating) !== -1) {
          roles.push('887423487436791818');
        } else if (['PP', 'SPP', 'CP', 'ATP', 'SFI', 'CFI'].indexOf(userIvaoInfo.pilotRating) !== -1) {
          roles.push('887423420147589171');
        }
      } else {
        roles.push('887432803699028039');
      }

      if (ivaoGuilds.length === 0) {
        // add user
        const res = await oauth.addMember({
          accessToken: oauthData.access_token,
          botToken: services.discord.token,
          guildId: services.ivao.server,
          userId: userData.id,
          nickname: `${userIvaoInfo.vid} - ${userIvaoInfo.firstname}`,
          roles
        });
      } else {
        const ivaoGuild = ivaoGuilds[0];
        const guild = await client.guilds.fetch(services.ivao.server);
        const member = await guild.members.fetch(userData.id);
        await member.setNickname(`${userIvaoInfo.vid} - ${userIvaoInfo.firstname}`);
        await member.roles.set(roles);
      }
    } catch (error) {
      // NOTE: An unauthorized token will not throw an error;
      // it will return a 401 Unauthorized response in the try block above
      return response.status(400).send('Unauthorized');
    }
  }

  response.redirect(`https://discord.com/channels/${services.ivao.server}`);
  // return response.send('You have successfully joined the IVAO IN Discord Server. You can now close this page and return to the Discord application.');
});

app.listen(services.port, () => console.log(`App listening at PORT ${services.port}`));

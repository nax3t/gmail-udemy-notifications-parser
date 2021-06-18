/**
 * @license
 * Copyright Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// [START gmail_quickstart]
const fs = require('fs');
const util = require('util');
const readline = require('readline');
const {google} = require('googleapis');
const writeFile = util.promisify(fs.writeFile);
const _ = require('lodash');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), listMessages);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

// [END gmail_quickstart]
// [START custom_functions]
/**
 * Lists the messages in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listMessages(auth) {
  const gmail = google.gmail({version: 'v1', auth});
  const messagesList = (options) => {
    return new Promise((resolve, reject) => {
      gmail.users.messages.list(options, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }
  const getMessage = (options) => {
    return new Promise((resolve, reject) => {
      gmail.users.messages.get(options, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }
  const batchModify = (options) => {
    return new Promise((resolve, reject) => {
      gmail.users.messages.batchModify(options, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  try {
    let repeat = true;
    let urls = [];
    while(repeat) {
      let q = `label:udemy-notifications is:unread`;
      let res = await messagesList({
        userId: 'me',
        q
      });
      let { messages } = res.data;
      if (messages && messages.length) {
        // iterate over messages and get each one then extract question url and push to urls array
        for (const message of messages) {
          let res = await getMessage({
            userId: 'me',
            id: message.id,
            format: 'full'
          })
          const buff = Buffer.from(res.data.payload.body.data, 'base64');
          // decode buffer as UTF-8
          const str = buff.toString('utf-8');
          const url = str.match(/https:\/\/e2\.udemymail\.com\/ls\/click.+?(?=")/i)[0];
          urls.push({url, threadId: message.threadId});
        };
        let ids = messages.map(m => m.id)
        await batchModify({
          userId: 'me',
          ids,
          removeLabelIds: ['UNREAD']
        })
      } else {
        repeat = false;
      }
    }
    urls = _.uniqBy(urls, 'threadId');
    urls = urls.map(url => url.url);
    console.log(`The urls array has ${urls.length} urls`);

    await writeFile("urls.js", JSON.stringify(urls));
    console.log("File written successfully\n");
  } catch(err) {
    return console.log(err);
  }
}
// [END custom_functions]


module.exports = {
  SCOPES,
  listMessages,
};
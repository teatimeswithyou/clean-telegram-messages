const fs = require('fs');
const input = require("input"); 

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require('telegram/tl');

// 4. Access your values from the config object
const apiId = process.env.apiId;
const apiHash = process.env.apiHash;

// Try to load an existing session from disk
let sessionString = '';
if (fs.existsSync('session')) {
  sessionString = fs.readFileSync('session', 'utf8');
}

const stringSession = new StringSession(sessionString);

// Basic helper to parse command-line args\
const args = process.argv.slice(2);

(async () => {
  // 1) Initialize the client
  const client = new TelegramClient(
    stringSession,
    Number(apiId),
    apiHash,
    {
      connectionRetries: 5,
    }
  );

  // 2) Connect or prompt login if needed
  console.log('Connecting to Telegram...');
  await client.start({
    phoneNumber: async () => await input.text("number ?"),
    password: async () => await input.text("password?"),
    phoneCode: async () => await input.text("Code ?"),
    onError: (err) => console.log('Error during login', err),
  });

  console.log('You are now logged in!');

  // Save the new/updated session back to disk so next time we skip login
  const updatedSession = client.session.save();
  fs.writeFileSync('session', updatedSession, 'utf8');
  console.log('Session saved to session file');

  // Check commands
  if (args[0] === '-s') {
    await showMyMessageCount(client);
  } else if (args[0] === '-d') {
    // e.g. node cleanTelegram.js -d 123456789 987654321 ...
    const groupIds = args.slice(1);
    if (groupIds.length === 0) {
      console.log('No group IDs provided for deletion. Exiting.');
      process.exit(0);
    }
    await deleteUserMessages(client, groupIds);
  } else {
    console.log(`
      Usage:
        node cleanTelegram.js -s
          Show a summary of groups (IDs, titles, approximate user message counts).

        node cleanTelegram.js -d <groupIds...>
          Delete your messages in given group IDs.
    `);
  }

  process.exit(0);
})().catch(console.error);

const defaultSearchOptions = {
  limit: 1,
  q: '',
  filter: new Api.InputMessagesFilterEmpty(),
  minDate: 0,
  maxDate: 0,
  offsetId: 0,
  addOffset: 0,
  maxId: 0,
  minId: 0,
  hash: 0,
}


const showMyMessageCount = async (client) => {
  try {
    // 1) Grab info about the current user
    const me = await client.getMe();

    // 2) Fetch dialogs (chats, groups, channels, etc.)
    const dialogs = await client.getDialogs({});

    console.log('Chats/Groups:');
    console.log('--------------------------------------------------------------');
    console.log('|  Chat ID      |  Title               |  My Messages Count |');
    console.log('--------------------------------------------------------------');

    // 3) For each dialog, if it’s a Channel or Chat, do a `messages.search` limited to messages from you
    for (const d of dialogs) {
      const entity = d.entity;
      if (entity.className === 'Channel' || entity.className === 'Chat') {
        let myMsgCount = 0;

        try {
          // We'll build a fromId referencing the current user
          // (If `me.accessHash` is undefined, try `new Api.InputPeerSelf()` instead)
          const fromId = new Api.InputPeerUser({
            userId: me.id,
            accessHash: me.accessHash,
          });

          // 4) Search for messages with fromId = current user
          //    limit = 1 but we only care about the .count property
          const result = await client.invoke(
            new Api.messages.Search({
              peer: entity,
              fromId: fromId,
              ...defaultSearchOptions
            })
          );

          // If successful, result.count should be the total # of messages from you
          if (result && typeof result.count === 'number') {
            myMsgCount = result.count;
          }
        } catch (err) {
          console.log(
            `Error fetching your message count for ${entity.id}:`,
            err.message
          );
        }
        if (myMsgCount > 0) {
        // 5) Print the table row
        console.log(
          `| ${entity.id.toString().padEnd(14)} | ` +
            `${entity.title.padEnd(20)} | ` +
            `${myMsgCount.toString().padEnd(19)}|`
        );
        }
      }
    }
    console.log('--------------------------------------------------------------');
  } catch (err) {
    console.error('Error fetching your messages count:', err);
  }
}

/**
 * Delete all messages (owned by current user) in the specified group IDs
 */
const deleteUserMessages = async (client, groupIds) => {
  try {
    for (const id of groupIds) {
      console.log(`\nDeleting messages in chat ID: ${id}`);

      // Attempt to get the chat object
      let chat;
      try {
        chat = await client.getEntity(new Api.PeerChannel({ channelId: id }));
      } catch {
        console.log(` - Skipping: Could not fetch entity for ID: ${id}`);
        continue;
      }

      const currentUser = await client.getMe();
      const userId = currentUser.id;

      const limit = 100; // number of messages to fetch per chunk
      let offsetId = 0;
      let totalDeleted = 0;

      // Keep fetching until no more messages
      while (true) {
        const search = await client.invoke(
          new Api.messages.Search({
            peer: chat,
            fromId: userId,
            ...defaultSearchOptions,
            limit, 
            offsetId,
          })
        );

        const history = search.messages

        if (!history || history.length === 0) {
          break;
        }

        // Extract IDs
        const msgIds = history.map((m) => m.id);

        // Delete them
        if (msgIds.length > 0) {
          await client.deleteMessages(chat, msgIds, { revoke: true });
          totalDeleted += msgIds.length;
          console.log(`   Deleted ${msgIds.length} messages...`);
        }

        // Move offset to oldest message in current chunk to continue backward
        offsetId = history[history.length - 1].id;
        if (history.length < limit) {
          // we’ve reached the end
          break;
        }
      }

      console.log(` - Finished deleting. Total deleted in ${id}: ${totalDeleted}`);
    }
    console.log('\nAll requested deletions complete.');
  } catch (err) {
    console.error('Error deleting messages:', err);
  }
}

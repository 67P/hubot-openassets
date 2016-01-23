// Description:
//   Manage a openassets wallet and send rewards to people
//
// Commands:
//   kredits address add <nick> <address> - Add an Open Assets address for a user
//   kredits address remove <nick> - Delete a user's addressbook entry
//   kredits address list - List all addressbook entries
//   kredits show <nick> - Show kredit balance of a user
//   kredits send <amount> to <nick> - Send kredits to a user
//   kredits list - Show list of all kredit holders
//
// Configuration:
//   OA_BOT_KEYWORD: The keyword for issuing asset commands. Usually the asset name in lowercase, e.g. "kredits"
//   OA_ASSET_ID: ID of the asset to be transferred
//   OA_ASSET_FROM_ADDRESS: Sender's wallet open asset address
//   OA_DEFAULT_QUANTITY: Quantity of assets that should be sent if not provided by the user
//   OA_SERVER_URL: URL of the open assets server that does the actual transfer
//   OA_SERVER_USERNAME: Username for server basic auth
//   OA_SERVER_PASSWORD: Password for server basic auth
//   OA_MAX_QUANTITY (optional): Maximum quantity of assets that can be transferred
//
// Authors:
//   Michael Bumann <hello@michaelbumann.com>
//   Sebastian Kippe <sebastian@kip.pe>

var Base58 = require('bs58');
var Put = require('bufferput');
var crypto = require('crypto');

module.exports = function(robot) {

  //
  // Address Book
  //

  let robotKeyword = process.env.OA_BOT_KEYWORD || 'kredits';

  let addressBook = {

    getContent() {
      return robot.brain.get(`openassets:addressBook:${robotKeyword}`) || {};
    },

    setContent(content) {
      return robot.brain.set(`openassets:addressBook:${robotKeyword}`, content);
    },

    add(nick, address) {
      if (typeof nick !== 'string' || typeof address !== 'string' || nick === '' || address === '' ) {
        return 'Sorry Dave, I can\'t do that. Need both a nickname and address to add an addressbook entry.';
      }
      let content = this.getContent();
      content[nick] = address;
      this.setContent(content);
      return `Added ${nick}'s address to the addressbook.`;
    },

    remove(nick) {
      if (typeof nick !== 'string' || nick === '') {
        return 'If you want me to delete someone\'s address, how about you give me their name?';
      }
      let content = this.getContent();
      delete content[nick];
      this.setContent(content);
      return `Removed ${nick}'s entry from the addressbook.`;
    },

    list() {
      if (Object.keys(this.getContent()).length === 0) {
        return `No entries in addressbook yet. Use "${robotKeyword} address add [name] [address]" to add one.`;
      } else {
        let content = this.getContent();
        let names = Object.keys(content);
        return names.map(name => `${name}: ${content[name]}`);
      }
    },

    lookupAddress(nick) {
      return this.getContent()[nick];
    },

    lookupName(address) {
      let content = this.getContent();
      let keys    = Object.keys(content);
      for (var i = 0; i< keys.length; i++) {
        if (content[keys[i]] === address) { return keys[i]; }
      }
    }
  };

  robot.hear(new RegExp(`${robotKeyword} address (add|remove|list)\\s*(\\.*)\\s*(\\.*)`, 'i'), function(res) {
    let command = res.match[1];
    let nick    = res.match[2];
    let address = res.match[3];
    let user    = res.message.user;
    let out;

    if (!robot.auth.isAdmin(user)) {
      res.reply('Sorry amigo, you\'re not authorized to manage the address book.');
      return;
    }

    switch(command) {
      case 'add':
        out = addressBook.add(nick, address);
        break;
      case 'remove':
        out = addressBook.remove(nick);
        break;
      case 'list':
        out = addressBook.list();
        break;
    }

    if (typeof out === 'string') {
      res.send(out);
    } else if (typeof out === 'object') {
      out.forEach(line => res.send(line));
    }
  });

  //
  // Assets listing and management
  //

  function balanceOfAddress(address, cb) {
    var balanceUrl = 'https://api.coinprism.com/v1/addresses/' + address;
    robot.http(balanceUrl).header('Content-Type', 'application/json')
      .get()(function(err, res, body) {
        if (!err && res.statusCode === 200) {
          var assets = JSON.parse(body).assets;
          var assetDetails = assets.filter(function(details) { return details.id === process.env.OA_ASSET_ID; })[0];
          cb(assetDetails, err, res, body);
        } else {
          cb(null, err, res, body);
        }
      });
  }

  function balanceOf(ircName, cb) {
    return balanceOfAddress(addressBook.lookupAddress(ircName), cb);
  }

  function totalBalanceOfAsset(assetDetails) {
    return parseInt(assetDetails.balance) + parseInt(assetDetails.unconfirmed_balance);
  }

  function addressFromBitcoinAddress(btcAddress) {
    function sha256(data) {
      return new Buffer(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
    }
    var btcAddr = new Buffer(Base58.decode(btcAddress));
    var btcBuff = new Put()
                  .word8(19)
                  .put(btcAddr.slice(0, -4))
    var btcCheck = sha256(sha256(btcBuff.buffer()));
    btcBuff.put(btcCheck.slice(0,4))

    return Base58.encode(btcBuff.buffer());
  }

  robot.hear(new RegExp(`${robotKeyword} show (.+)`, 'i'), function(hearResponse) {
    balanceOf(hearResponse.match[1], function(assetDetails) {
      if (assetDetails) {
        hearResponse.send( hearResponse.match[1] + ' has ' + totalBalanceOfAsset(assetDetails) + ' ' + robotKeyword);
      } else {
        hearResponse.reply('not found');
      }
    });
  });

  robot.hear(new RegExp(`${robotKeyword} list`, 'i'), function(hearResponse) {
    var assetUrl = 'https://api.coinprism.com/v1/assets/' + process.env.OA_ASSET_ID + '/owners';
    robot.http(assetUrl).header('Content-Type', 'application/json')
      .get()(function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(err);
          return false;
        }
        var asset = JSON.parse(body);
        var owners = asset.owners;
        var displayTotal = owners.length > 10 ? 10 : owners.length;
        var totalAssets = 0;
        owners.forEach(function(o) { totalAssets += parseInt(o.asset_quantity); });
        for (var i=0; i<displayTotal; i++) {
          var oaAddress = addressFromBitcoinAddress(owners[i].address);
          var name = addressBook.lookupName(oaAddress) || oaAddress;
          hearResponse.send(name + ': ' + owners[i].asset_quantity);
        }
        hearResponse.send(`${totalAssets} ${robotKeyword} total, owned by ${owners.length} addresses. details: https://www.coinprism.info/asset/${process.env.OA_ASSET_ID}/owners`);
      });
  });

  robot.hear(/(\w+)\s?\+\+/i, function(hearResponse) {
    let user = hearResponse.message.user;
    if (!robot.auth.isAdmin(user)) {
      return;
    }

    var recipient = hearResponse.match[1];
    var destination = addressBook.lookupAddress(recipient);
    if(!destination) { return false; }

    var quantity = process.env.OA_DEFAULT_QUANTITY;

    sendKredits(destination, quantity, function(err, res, body) {
      if (err || res.statusCode !== 200) {
        console.log(err);
        console.log(body);
      }
    });

  });

  robot.hear(new RegExp(`${robotKeyword} send (\\d*)\\s?to (\\w+).*`, 'i'), function(hearResponse) {
    let user = hearResponse.message.user;
    if (!robot.auth.isAdmin(user)) {
      hearResponse.reply('Sorry amigo, I\'m afraid I can not do that.');
      return;
    }

    var recipient = hearResponse.match[2];
    var destination = addressBook.lookupAddress(recipient);
    if(!destination) {
      hearResponse.reply("sorry, I don't know the address of " + recipient);
      return false;
    }
    var quantity = hearResponse.match[1];
    if(!quantity) { quantity = process.env.OA_DEFAULT_QUANTITY; }

    if(process.env.OA_MAX_QUANTITY && quantity > process.env.OA_MAX_QUANTITY) {
      robot.logger.info("quantity exceeds maximum. ignoring");
      hearResponse.reply("oh, that's a bit too much, isn't it?");
      return false;
    }

    console.log("sending " + quantity + " to: " + recipient);

    sendKredits(destination, quantity, function(err, res, body) {
      if(err || res.statusCode !== 200) {
        console.log(err);
        console.log(body);
        var error = JSON.parse(body);
        hearResponse.send("damn, something is wrong with the asset server: " + error.message);
        return false;
      }
      var tx = JSON.parse(body);
      hearResponse.reply(`OK, done! (transaction should be propagated in a bit: https://www.coinprism.info/tx/${tx.hash} )`);
    });

  });

  function sendKredits(destination, quantity, cb) {
    console.log("sending " + quantity + " to: " + destination);

    var params = {
      "from": process.env.OA_ASSET_FROM_ADDRESS,
      "to": destination,
      "asset_id": process.env.OA_ASSET_ID,
      "amount": quantity
    };

    console.log(params);
    robot.http(process.env.OA_SERVER_URL + '/send_asset')
      .header('Content-Type', 'application/json')
      .auth(process.env.OA_SERVER_USERNAME, process.env.OA_SERVER_PASSWORD)
      .query(params).post()(function(err, res, body) {
        if(err || res.statusCode !== 200) {
          console.log("sending assets failed");
        }
        console.log(body);

        cb(err, res, body);
      });
  }
};

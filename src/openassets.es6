// Description:
//   Manage a openassets wallet and send rewards to people
//
// Configuration:
//
//   OA_ASSET_FROM_ADDRESS: sender's wallet open asset address
//   OA_DEFAULT_QUANTITY: qunatity of assets that should be sent if not provided by the user
//   OA_ASSET_ID: ID of the asset to be transferred
//   OA_SERVER_URL: URL of the open assets server that does the actual transfer
//   OA_SERVER_USERNAME: username for server basic auth
//   OA_SERVER_PASSWORD: password for server basic auth
//   OA_MAX_QUANTITY (optional): maximum quantity of assets that can be transferred
//
// Commands:
//   kredits address add <nick> <address> - Add an Open Assets address for a user
//   kredits address remove <nick> - Delete a user's addressbook entry
//   kredits address list - List all addressbook entries
//   kredits show <nick> - Show kredit balance of a user
//   kredits send <amount> to <nick> - Send kredits to a user
//   kredits list - Show list of all kredit holders
//
// Authors:
//   Michael Bumann <hello@michaelbumann.com>
//   Sebastian Kippe <sebastian@kip.pe>

module.exports = function(robot) {

  //
  // Address Book
  //

  let addressBook = {

    getContent() {
      return robot.brain.get('openassets:addressBook:kredits') || {};
    },

    setContent(content) {
      return robot.brain.set('openassets:addressBook:kredits', content);
    },

    add(nick, address) {
      if (typeof nick !== 'string' || typeof address !== 'string') {
        return 'Sorry Dave, I can\'t do that. Need both a nickname and address to add an addressbook entry.';
      }
      let content = this.getContent();
      content[nick] = address;
      this.setContent(content);
      return `Added ${nick}'s address to the addressbook.`;
    },

    remove(nick) {
      if (typeof nick !== 'string') {
        return 'If you want me to delete someone\'s kredits address, how about you give me their name?';
      }
      let content = this.getContent();
      delete content[nick];
      this.setContent(content);
      return `Removed ${nick}'s entry from the addressbook.`;
    },

    list() {
      if (Object.keys(this.getContent()).length === 0) {
        return 'No entries in addressbook yet. Use "kredits address add [name] [address]" to add one.';
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
      Object.keys(content).forEach(name => {
        if (content[name] === address) { return name; }
      });
    }
  };

  robot.hear(/kredits address (add|remove|list)\s*(\w*)\s*(\w*)/i, function(res) {
    let command = res.match[1];
    let nick    = res.match[2];
    let address = res.match[3];
    let user    = res.message.user;
    let out;

    if (!robot.auth.isAdmin(user)) {
      res.reply('Sorry amigo, you\'re not authorized to manage the Kredits address book.');
      return;
    }

    switch(command) {
      case 'add':
        out = addressBook.add(nick, address);
        break;
      case 'delete':
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

  robot.hear(/kredits show (.+)/i, function(hearResponse) {
    balanceOf(hearResponse.match[1], function(assetDetails) {
      if (assetDetails) {
        hearResponse.send( hearResponse.match[1] + ' has ' + totalBalanceOfAsset(assetDetails) + ' kredits');
      } else {
        hearResponse.reply('not found');
      }
    });
  });

  robot.hear(/kredits list/i, function(hearResponse) {
    var assetUrl = 'https://api.coinprism.com/v1/assets/' + process.env.OA_ASSET_ID + '/owners';
    robot.http(assetUrl).header('Content-Type', 'application/json')
      .get()(function(err, res, body) {
        if (err || res.statusCode !== 200) {
          console.log(err);
          return false;
        }
        var owners = JSON.parse(body).owners;
        var total = owners.length > 10 ? 10 : owners.length;
        for (var i=0; i<total; i++) {
          var name = addressBook.lookupName(owners[i].address) || owners[i].address;
          hearResponse.send(name + ': ' + owners[i].asset_quantity);
        }
      });
  });

  robot.hear(/(\w+)\s?\+\+/i, function(hearResponse) {
    let user = hearResponse.message.user;
    if (!robot.auth.isAdmin(user)) {
      hearResponse.reply('Sorry amigo, I\'m afraid I can not do that.');
      return;
    }

    var recipient = hearResponse.match[1];
    var destination = addressBook.lookupAddress(recipient);
    if(!destination) { return false; }

    var quantity = process.env.OA_DEFAULT_QUANTITY;

    sendKredits(destination, quantity, function(err, res, body) {
      if (err || res.statusCode !== 200) {
        console.log(err);
      }
    });

  });

  robot.hear(/kredits send (\d*)\s?to (\w+).*/i, function(hearResponse) {
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

    console.log("sending " + quantity + " kredits to: " + recipient);

    sendKredits(destination, quantity, function(err, res, body) {
      if(err || res.statusCode !== 200) {
        hearResponse.send("damn, something is wrong with the asset server.");
        return false;
      }
      hearResponse.reply('OK, kredited');
    });

  });

  function sendKredits(destination, quantity, cb) {
    console.log("sending " + quantity + " kredits to: " + destination);

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
      .query(params).post()(cb) 
  }
};

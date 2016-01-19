// Description:
//  Manage a openassets wallet and send rewards to people
//
// Configuration:
//
// OA_ASSET_FROM_ADDRESS: sender's wallet open asset address
// OA_DEFAULT_QUANTITY: qunatity of assets that should be sent if not provided by the user
// OA_ASSET_ID: ID of the asset to be transferred
// OA_SERVER_URL: URL of the open assets server that does the actual transfer
// OA_SERVER_USERNAME: username for server basic auth
// OA_SERVER_PASSWORD: password for server basic auth
// OA_MAX_QUANTITY (optional): maximum quantity of assets that can be transferred
//
//
// Author:
//  Michael Bumann <hello@michaelbumann.com>


module.exports = function(robot) {
  function lookupAddressFor(ircName) {
    ircName = ircName.replace(/\s*/,'').toLowerCase();
    return {'bumi': 'akCseA2PCgqn8JYAmdFBKzaAQpxJiQ1bECc'}[ircName];
  }
  function lookupNameFor(address) {
    return {'akDWac1wFCFtaF2omEZ5KLTPMMPS4C5s89H': 'bumi'}[address];
  }

  function balanceOfAddress(address, cb) {
    var balanceUrl = 'https://api.coinprism.com/v1/addresses/' + address;
    console.log(balanceUrl);
    robot.http(balanceUrl).header('Content-Type', 'application/json')
      .get()(function(err, res, body) {
        if(!err && res.statusCode === 200) {
          var assets = JSON.parse(body)['assets'];
          var assetDetails = assets.filter(function(details) { return details['id'] === process.env.OA_ASSET_ID })[0];
          cb(assetDetails, err, res, body);
        } else{
          cb(null, err, res, body);
        }
      });
  }
  function balanceOf(ircName, cb) {
    return balanceOfAddress(lookupAddressFor(ircName), cb);
  }

  function totalBalanceOfAsset(assetDetails) {
    return parseInt(assetDetails['balance']) + parseInt(assetDetails['unconfirmed_balance']);
  }

  robot.hear(/kredits show (.+)/i, function(hearResponse) {
    balanceOf(hearResponse.match[1], function(assetDetails) {
      if(assetDetails) {
        hearResponse.reply( hearResponse.match[1] + ' has ' + totalBalanceOfAsset(assetDetails) + ' kredits');
      } else
        hearResponse.reply('not found');
    })
  });

  robot.hear(/kredits list/i, function(hearResponse) {
    var assetUrl = 'https://api.coinprism.com/v1/assets/' + process.env.OA_ASSET_ID + '/owners';
    console.log(assetUrl);
    robot.http(assetUrl).header('Content-Type', 'application/json')
      .get()(function(err, res, body) {
        if(!err && res.statusCode === 200) {
          var owners = JSON.parse(body)['owners'];
          var total = owners.length > 10 ? 10 : owners.length;
          for(i=0; i++; i<total) {
            var name = lookupNameFor(owners[i]['address']) || owners[i]['address'];
            hearResponse.reply(name + ': ' + owners[i]['asset_quantity'] + ' Kredits');
          }
        }
      })
  });

  robot.hear(/kredits send (\d*)\s?to (.+)/i, function(hearResponse) {
    var recipient = hearResponse.match[2];
    var destination = lookupAddressFor(recipient);
    var quantity = hearResponse.match[1];
    if(!quantity) { quantity = process.env.OA_DEFAULT_QUANTITY; }

    if(process.env.OA_MAX_QUANTITY && quantity > process.env.OA_MAX_QUANTITY) {
      robot.logger.info("quantity exceeds maximum. ignoring");
      hearResponse.reply("oh, that's a bit too much, isn't it?");
      return false;
    }

    console.log("sending " + quantity + " kredits to: " + recipient);

    var params = {
      "from": process.env.OA_ASSET_FROM_ADDRESS,
      "to": destination,
      "asset_id": process.env.OA_ASSET_ID,
      "quantity": quantity
    };

    robot.http(process.env.OA_SERVER_URL + '/send_asset')
      .header('Content-Type', 'application/json')
      .req.auth(process.env.OA_SERVER_USERNAME, process.env.OA_SERVER_PASSWORD)
      .post(params)(function(err, res, body) {
        if(err || res.statusCode != 200) {
          hearResponse.send("damn, something is wrong with the asset server :(")
          return false;
        }
        hearResponse.reply('OK, kredited');
      });
  });

}


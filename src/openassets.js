// Description:
//  Manage a openassets wallet and send rewards to people
//
// Dependencies:
//
// Configuration:
//
// Author:
//  Michael Bumann <hello@michaelbumann.com>


module.exports = function(robot) {
  function lookupAddressFor(ircName) {
    ircName = ircName.replace(/\s*/,'').toLowerCase();
    return {'bumi': 'akDWac1wFCFtaF2omEZ5KLTPMMPS4C5s89H'}[ircName];
  }

  robot.hear(/send (\d*)\s?kredits to (.+)/i, function(hearResponse) {
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
      "to": destination,
      "asset_id": process.env.OA_ASSET_ID,
      "quantity": quantity
    };
    console.log(params);

    robot.http(process.env.OA_SERVER_URL + '/send_asset')
      .header('Content-Type', 'application/json')
      .post(params)(function(err, res, body) {
        if(err || res.statusCode != 200) {
          hearResponse.send("damn, something is wrong with the asset server :(")
          return false;
        }
        var balanceUrl = 'https://api.coinprism.com/v1/addresses/' + destination;
        robot.http(balanceUrl)
          .header('Content-Type', 'application/json')
          .get()(function(err, res, body) {
            var addressData = JSON.parse(body);
            var response = 'OK, kredited';
            if(!err && res.statusCode === 200) {
              var assets = addressData['assets'];
              var assetDetails = assets.filter(function(details) { return details['id'] === process.env.OA_ASSET_ID })[0];
              console.log(assetDetails);
              if(assetDetails) {
                response = response + ' - ' + recipient + ' has ' + assetDetails['unconfirmed_balance'] + ' kredits';
              }
            }
            hearResponse.reply(response);
          });
      });

  });

}


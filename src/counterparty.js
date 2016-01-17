module.exports = function(robot) {
  robot.hear(/send (\d*)\s?kredits to (.+)/i, function(res) {
    var recipient = res.match[1];
    var destination = recipient; // TODO: lookup recipient address
    var quantity = res.match[1];
    if(!quantity) { quantity = process.env.OA_DEFAULT_QUANTITY; }

    log("sending " + quantity + " kredits to: " + recipient);

    var params = {
      "to": destination,
      "asset_id": process.env.OA_ASSET_ID,
      "quantity": quantity
    };
    log(params);


    robot.http(process.env.OA_SERVER_URL)
      .header('Content-Type', 'application/json')
      .post(data)(function(err, res, body) {
        if(res.statusCode != 200) {
          res.send "damn, something is wrong with the asset server :("
          return
        }
        var balanceUrl = 'https://api.coinprism.com/v1/addresses/' + destination;
        robot.http(balanceUrl)
          .header('Content-Type', 'application/json')
          .get()(function(err, res, body) {
            var assets = body['assets'];
            var assetDetails = assets.filter(function(details) { details['id'] === process.env.OA_ASSET_ID });
              unconfirmedBalance = assetDetails['unconfirmed_balance'];
            }

            var response = 'kredited';
            if(assetDetails) {
              response = response + ' ' + recipient + ' has ' + assetDetails['unconfirmed_balance'] + ' kredits';
            }
            res.reply(response);
          });
      });

  });

}

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
//   OA_PLUSPLUS_ROOMS (optional): in which room the ++ should be enabled
//
// Authors:
//   Michael Bumann <hello@michaelbumann.com>
//   Sebastian Kippe <sebastian@kip.pe>

module.exports = function(robot) {
  require('strict-mode')(function() {
    require("./src/openassets")(robot);
  });
};

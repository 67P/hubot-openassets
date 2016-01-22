module.exports = function(robot) {
  require('strict-mode')(function() {
    require("./src/openassets")(robot);
  });
};

require("babel/register")({
  ignore: false,
  extensions: [".es6", ".es"]
});

module.exports = function(robot) {
  require("./src/openassets")(robot);
};

console.log('loaded openassets');

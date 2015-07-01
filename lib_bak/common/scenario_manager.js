var fs = require('fs')
  , path = require('path')
  , f = require('util').format;

var ScenarioManager = function() {
  this.scenarios = [];
}

ScenarioManager.prototype.load = function(p) {
  var entries = fs.readdirSync(p).filter(function(x) {
    return x.indexOf('.js') != -1;
  });

  // Get all the scenario modules
  for(var i = entries.length - 1; i >= 0; i--) {
    // Resolve the module
    var mod = require(path.resolve(p, entries[i]));
    // Add all the scenarios
    this.scenarios = this.scenarios.concat(mod.scenarios);
  };

  return this;
}

ScenarioManager.prototype.find = function(name) {
  // Look in out scenarios catalog
  for (var i = this.scenarios.length - 1; i >= 0; i--) {
    if(this.scenarios[i].name == name) return this.scenarios[i];
  };

  return null;
}

ScenarioManager.prototype.list = function() {
  return this.scenarios;
}

module.exports = ScenarioManager;

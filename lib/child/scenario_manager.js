var fs = require('fs')
  f = require('util').format;

var ScenarioManager = function() {  
  this.scenarios = [];
}

ScenarioManager.prototype.load = function(path) {
  var entries = fs.readdirSync(path).filter(function(x) {
    return x.indexOf('.js') != -1;
  });

  // Get all the scenario modules
  for(var i = entries.length - 1; i >= 0; i--) {
    // Resolve the module
    var mod = require(f('%s/%s/%s', process.cwd(), path, entries[i]));
    // Add all the scenarios
    this.scenarios = this.scenarios.concat(mod.scenarios);
  };
}

ScenarioManager.prototype.find = function(name) {
  // Look in out scenarios catalog
  for (var i = this.scenarios.length - 1; i >= 0; i--) {
    if(this.scenarios[i].name == name) return this.scenarios[i];
  };
  
  return null;
}

module.exports = ScenarioManager;
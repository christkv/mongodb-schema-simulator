"use strict";

var fs = require('fs')
  , path = require('path')
  , f = require('util').format;

class ScenarioManager {
  constructor(path) {
    this.path = path;
    this.scenarios = [];
  }

  load() {
    // Read all the scenarios
    var entries = fs.readdirSync(this.path).filter(function(x) {
      return x.indexOf('.js') != -1;
    });

    // Get all the scenario modules
    for(var i = entries.length - 1; i >= 0; i--) {
      // Resolve the module
      var mod = require(path.resolve(this.path, entries[i]));
      // Add all the scenarios
      this.scenarios = this.scenarios.concat(mod.scenarios);
    };

    return this;
  }

  find(name) {
    // Look in out scenarios catalog
    for (var i = this.scenarios.length - 1; i >= 0; i--) {
      if(this.scenarios[i].name == name) return this.scenarios[i];
    };

    return null;
  }

  list() {
    return this.scenarios;
  }
}

module.exports = ScenarioManager;

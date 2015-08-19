"use strict";

var co = require('co'),
  Basic = require('./reports/basic');

class Report {
  constructor(options) {
    options = options || {};
    this.filename = options.filename || './out/report.json';
    this.dbPath = options.dbPath || './out/db';
    this.output = options.output || './out';
    this.outputFilename = options.outputFilename || 'index.html';
  }

  execute() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Setup the basic report
        var report = new Basic({
          filename: self.filename,
          dbPath: self.dbPath,
          output: self.output,
          outputFilename: self.outputFilename
        });

        // Execute the basic report
        yield report.execute();
        resolve();
      }).catch(function(err) {
        console.log(err.stack);
        reject(err);
      });
    });
  }
}

module.exports = Report;
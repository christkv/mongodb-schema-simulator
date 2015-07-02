"use strict";

var co = require('co'),
  Basic = require('./reports/basic');

class Report {
  constructor(options) {
    options = options || {};
    this.filename = options.filename || './out/report.json';
    this.dbPath = options.dbPath || './out/db';
    this.output = options.output || './out';
  }

  execute() {
    var self = this;

    return new Promise((resolve, reject) => {
      co(function* () {
        // Setup the basic report
        var report = new Basic({
          filename: self.filename,
          dbPath: self.dbPath,
          output: self.output
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

co(function*() {
  yield new Report({}).execute();
});

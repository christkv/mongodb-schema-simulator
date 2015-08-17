"use strict";

var f = require('util').format
  , fs = require('fs')
  , co = require('co')
  , ejs = require('ejs')
  , path = require('path')
  , levelup = require('levelup')
  , Stats = require('fast-stats').Stats;

class Report {
  constructor(options) {
    options = options || {};
    // Unpack the options
    this.filename = options.filename;
    this.output = options.output;
    this.dbPath = options.dbPath;
  }

  execute() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Read in the report document
        self.reportObject = JSON.parse(fs.readFileSync(self.filename, 'utf8'));
        // Decompose the document
        self.report = self.reportObject.report;
        self.runtime = self.reportObject.runtime;
        self.topologyData = self.reportObject.topologyData;

        // Get the basic runtime parameters
        self.startTimeMS = self.runtime.startTimeMS;
        self.endTimeMS = self.runtime.endTimeMS;
        self.totalTimeMS = self.endTimeMS - self.startTimeMS;
        self.processes = self.runtime.processes;

        // Collect all the measurements for each tag
        var measurements = {};
        // Attempt to read the db
        var db = levelup(self.dbPath);

        // Create the report read stream
        var stream = db.createReadStream();
        stream.on('data', function(data) {
          var obj = JSON.parse(data.value);
          if(measurements[obj.tag] == null) measurements[obj.tag] = [];
          measurements[obj.tag].push(obj);
        });

        stream.on('end', function() {
          co(function*() {
            var scenarioHtml = yield renderScenarios(self, measurements);
            var topologyHtml = yield renderTopologies(self, self.topologyData);
            var result = yield mergeReports(self, {scenarios:scenarioHtml, topologies: topologyHtml});
            resolve();
          }).catch(function(err) {
            reject(err);
          });
        });
      }).catch(reject);
    });
  }
}

/*
 * Render the topology data
 */
var renderTopologies = function(self, topologies) {
  return new Promise(function(resolve, reject) {
    // Get the topologies data
    var template = fs.readFileSync(__dirname + "/./templates/topologies_template.ejs", 'utf8');
    // All data
    var data = {};

    // Reformat the content by timestamp
    for(var name in topologies) {
      // Sort by timestamp
      var timestamps = {};

      for(var s in topologies[name]) {
        var entries = topologies[name][s];
        entries.forEach(function(x) {
          x = JSON.parse(x);

          if(timestamps[x.timestamp] == null) {
            timestamps[x.timestamp] = [];
          }

          timestamps[x.timestamp].push(x)
        });
      }

      data[name] = timestamps;
    }

    // Render the template
    var html = ejs.render(template, {
      entries: data
    });

    // Call back with results
    resolve(html);
  });
}

/*
 * Render the scenario data
 */
var renderScenarios = function(self, scenarios) {
  return new Promise(function(resolve, reject) {
    var template = fs.readFileSync(__dirname + "/./templates/scenarios_template.ejs", 'utf8');
    // Log Entries empty
    var logEntries = {};
    var fastStatistics = {};

    // Get the schema
    var schemas = self.report;

    // Transform the data to be the count by timestamp
    var entries = {};

    // Calculate all the statistical values of the set
    for(var name in scenarios) {
      // Create new stats runners
      fastStatistics[name] = new Stats();
      // Add a new entries dialog to count all timestamp values
      if(entries[name] == null) entries[name] = {};

      // Get the measurements
      var measurements = scenarios[name];
      for(var i = 0; i < measurements.length; i++) {
        var timestamp = measurements[i].timestamp;
        var obj = measurements[i].object;

        // Add to statistics
        fastStatistics[name].push(obj.time);

        // Do we have any entries for this timestamp
        if(entries[name][timestamp] == null) {
          entries[name][timestamp] = 0;
        }

        // Increment the timestamp
        entries[name][timestamp] = entries[name][timestamp] + 1;
      }
    }

    // Transform all the entries into arrays of value object and sort by timestamp
    for(var name in entries) {
      var values = entries[name];
      var valueObjects = [];

      for(var timestamp in values) {
        valueObjects.push({
          timestamp: parseInt(timestamp, 10), count: values[timestamp]
        });
      }

      // Sort the array by timestamp ASCENDING
      valueObjects.sort(function(a, b) {
        return a.timestamp - b.timestamp;
      })

      // Save the value
      entries[name] = valueObjects;
    }

    // Render the template
    var html = ejs.render(template, {
        entries: entries
      , schemas: schemas
      , fastStatistics: fastStatistics
      , general: {
          startTimeMS: self.startTimeMS
        , processes: self.processes
        , endTimeMS: self.endTimeMS
        , totalTimeMS: self.totalTimeMS
      }
    });

    // Call back with results
    resolve(html);
  });
}

/*
 * Merge the html into a final report
 */
var mergeReports = function(self, entries, callback) {
  return new Promise(function(resolve, reject) {
    var template = fs.readFileSync(__dirname + "/./templates/merge_template.ejs", 'utf8');

    // Render the template
    var html = ejs.render(template, {
      entries: entries
    });

    // Write report out
    var filename = f('%s/index.html', self.output);
    // Write data to disk
    fs.writeFileSync(filename, html, 'utf8');
    resolve();
  });
}

module.exports = Report;

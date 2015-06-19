var f = require('util').format
  , fs = require('fs')
  , co = require('co')
  , ejs = require('ejs')
  , path = require('path')
  , levelup = require('levelup')
  , Stats = require('fast-stats').Stats;

class BasicReport {
  constructor(monitor, filename) {
    this.monitor = monitor;
    this.filename = filename;
  }

  execute() {
    var self = this;

    return new Promise(function(resolve, reject) {
      var topologyFeeds = [];
      // Read the report in
      var reportObject = JSON.parse(fs.readFileSync(this.filename, 'utf8'))
      var report = reportObject.report;

      // Iterate over all the items
      for(var filename in report) {
        if(report[filename].type == 'topology') {
          topologyFeeds.push({filename: filename, config: report[filename]});
        }
      }

      // Save basic info
      this.startTimeMS = reportObject.startTimeMS;
      this.endTimeMS = reportObject.endTimeMS;
      this.totalTimeMS = this.endTimeMS - this.startTimeMS;

      // Collect all the measurements for each tag
      var measurements = {};

      // Attempt to read the db
      var db = levelup(this.monitor.argv['report-db-path'] || f('%s/db', self.monitor.argv.o));

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
          var topologyFeeds = yield renderTopologies(self, topologyFeeds);
          var result = yield mergeReports(self, {scenarios:scenarioHtml, topologies: topologyHtml});
        }).catch(function(err) {
          reject(err);
        });
      });
    });
  }
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
    var schemas = self.monitor.scenario;

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
      , argv: self.monitor.argv
      , general: {
          startTimeMS: self.startTimeMS
        , endTimeMS: self.endTimeMS
        , totalTimeMS: self.totalTimeMS
      }
    });

    // Call back with results
    resolve(html);
  });
}

/*
 * Render the topology data
 */
var renderTopologies = function(self, topologies, callback) {
  return new Promise(function(resolve, reject) {
    // Get the topologies data
    var template = fs.readFileSync(__dirname + "/./templates/topologies_template.ejs", 'utf8');
    // All data
    var data = {};

    // For each scenario file get the data
    topologies.forEach(function(x) {
      // Get the name of the topology
      var extname = path.extname(x.filename);
      var name = path.basename(x.filename, extname);
      // Read in the data and parse it
      var entries = JSON.parse(fs.readFileSync(x.filename, 'utf8'));
      // Split out the parts of the data
      var host = data.host;
      var port = data.port;

      // Clean up the data
      var filteredData = {};

      // Iterate over all the entries
      for(var id in entries) {
        var entry = entries[id];
        // Add a timestamp and merge the data
        if(!filteredData[entry.timestamp]) filteredData[entry.timestamp] = [];
        filteredData[entry.timestamp].push(entry);
      }

      // Add to data
      data[name] = filteredData;
    });

    // Render the template
    var html = ejs.render(template, {
      entries: data
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
    var filename = f('%s/index.html', self.monitor.argv.o);
    // Write data to disk
    fs.writeFileSync(filename, html, 'utf8');
    resolve();
  });
}

module.exports = BasicReport;

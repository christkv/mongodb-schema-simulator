var f = require('util').format
  , fs = require('fs')
  , ejs = require('ejs')
  , path = require('path')
  , levelup = require('levelup')  
  , RunningStats = require('../gnuplot/running_stats')
  , Stats = require('fast-stats').Stats
  , gnuplot = require('../gnuplot/gnuplot');

var generateOperations = function(self, name, data, callback) {
  console.log(f('[MONITOR] generating schema ops graph for %s', name));
  var keys = Object.keys(data);
  var points = [];
  // Filename
  var filename = f('%s/%s.png', self.argv.o, name);
  // Create a new line graph
  var graph = new gnuplot.Line({debug:self.argv.debug});
  graph.terminal('png');
  graph.output(filename);
  graph.xlabel('seconds');
  graph.ylabel('ops');
  graph.title(f('%s', name.replace(/\_/g, ' ')));
  graph.style('data linespoints');

  var labels = [];
  // Figure out the length and create the point array
  for(var i = 0; i < keys.length; i++) {
    labels.push(i);
  }
  // Add the labels
  graph.addData(labels);

  // Iterate over the data in each pocket
  for(var i = 0; i < keys.length; i++) {
    // Get the key
    var key = keys[i];
    // Add the count
    points.push(data[key].length);
  }

  // Add the points
  graph.addData(points);
  // Plot commands
  var lines = [];
  // Add the data
  lines.push(f('"-" using 1:2 title "%s"', name.replace(/\_/g, ' ')));
  // Set the plot commands
  graph.plotData(lines);
  graph.execute(function() {
    callback('schema', {
        name:name
      , path: filename
      , filename: f('%s.png', name)
    });
  });
}

var generateServerOperations = function(self, name, data, callback) {
  console.log(f('[MONITOR] generating server ops graph for %s', name));

  var keys = Object.keys(data);
  var points = [];

  // Get calibration point
  var calibrationKey = keys.shift();
  var firstMeasurments = data[calibrationKey];
  delete data[calibrationKey];

  // Create by host
  var readingByHost = {}
  for(var i = 0; i < firstMeasurments.length; i++) {
    readingByHost[firstMeasurments[i].host] = firstMeasurments[i];
  }

  // For all the data we need to adjust the readings based on the intial
  // reading
  for(var i = 0; i < keys.length; i++) {
    var measurements = data[keys[i]];
    var newMeasurments = [];

    // Adjust the measurments
    for(var j = 0; j < measurements.length; j++) {
      newMeasurments[j] = {
        "insert": measurements[j].insert - readingByHost[measurements[j].host].insert,
        "query": measurements[j].query - readingByHost[measurements[j].host].query,
        "update": measurements[j].update - readingByHost[measurements[j].host].update,
        "delete": measurements[j].delete - readingByHost[measurements[j].host].delete,
        "getmore": measurements[j].getmore - readingByHost[measurements[j].host].getmore,
        "command": measurements[j].command - readingByHost[measurements[j].host].command,
        "host": measurements[j].host
      }

      readingByHost[measurements[j].host] = measurements[j];
    }

    // Save the adjusted measurement
    data[keys[i]] = newMeasurments;
  }

  // Sum up all the results into a single set
  for(var i = 0; i < keys.length; i++) {
    var measurements = data[keys[i]];
    // Single measurement
    if(measurements.length == 1) break;
    // Sum up all the measurements
    var finalmeasure = measurements[0];
    // Add the values together
    for(var j = 1; j < measurements.length; j++) {
      finalmeasure.insert += measurements[j].insert;
      finalmeasure.query += measurements[j].query;
      finalmeasure.update += measurements[j].update;
      finalmeasure.delete += measurements[j].delete;
      finalmeasure.getmore += measurements[j].getmore;
      finalmeasure.command += measurements[j].command;
    }

    // Add the summed up value
    data[keys[i]] = [finalmeasure];
  }

  // Filename
  var filename = f('%s/%s.png', self.argv.o, name);
  // Create a new line graph
  var graph = new gnuplot.Line({debug:self.argv.debug});
  graph.terminal('png');
  graph.output(filename);
  graph.xlabel('seconds');
  graph.ylabel('ops');
  graph.title(f('processes: %s, concurrency: %s, runs: %s, engine: %s'
    , self.argv.n
    , ''
    , ''
    , ''));
  graph.style('data linespoints');

  var labels = [];
  // Figure out the length and create the point array
  for(var i = 0; i < keys.length; i++) {
    labels.push(i);
  }
  // Add the labels
  graph.addData(labels);
  // Lines rendered
  var count = 2;

  // Reformat the data based on ops type
  // var fields = Object.keys(data[keys[0]][0]);
  var fields = ['insert', 'query', 'update', 'delete', 'getmore', 'command'];
  var lines = [];

  // Iterate over all the fields
  for(var j = 0; j < fields.length; j++) {
    var n = fields[j];
    var entries = [];

    // Iterate over all the results
    for(var k = 0; k < keys.length; k++) {
      entries.push(data[keys[k]][0][n]);
    }

    graph.addData(entries);
  }

  // Create the descriptive lines
  for(var j = 0; j < fields.length; j++) {
    lines.push(f('"-" using 1:%s title "%s"', count++, fields[j]));
  }
  // Set the plot commands
  graph.plotData(lines);
  graph.execute(function() {
    callback('server', {
        name:name
      , path: filename
      , filename: f('%s.png', name)
    });
  });
}

/*
 * Generate report for the collected data
 */
var generateReport = function(self, logEntries, callback) {
  var count = Object.keys(logEntries).length;
  // All graph object
  var serverGraphs = [];
  var schemaGraphs = [];

  // Join up all generation
  var finish = function(type, data) {
    count = count - 1;

    // Save the returned data
    if(type == 'schema') schemaGraphs.push(data);
    if(type == 'server') serverGraphs.push(data);

    // We need to generate the actual report
    if(count == 0) {
      // Render the actual report
      renderHTMLReport(self, logEntries, schemaGraphs, serverGraphs, callback)
    }
  }

  // Go over all the values
  for(var name in logEntries) {
    console.log(f('[MONITOR] generating graph for %s', name));

    // Check what type of data it is
    var data = logEntries[name];
    var keys = Object.keys(data);

    // Check if we have a op time recording
    if(keys.length > 0 && data[keys[0]][0].start != null && data[keys[0]][0].end != null && data[keys[0]][0].time != null) {
      console.log(f('[MONITOR] generating ops graph for %s', name));
      generateOperations(self, name, data, finish);
    } else if(keys.length > 0 && data[keys[0]][0].insert != null && data[keys[0]][0].update != null && data[keys[0]][0].query != null) {
      console.log(f('[MONITOR] generating server ops graph for %s', name));
      generateServerOperations(self, name, data, finish);
    } else {
      callback(new Error(f('did not receive compatible data %s', JSON.stringify(data[keys[0]][0]))))
    }
  }
}

/*
 * Render the HTML report
 */
var renderHTMLReport = function(self, logEntries, schemaGraphs, serverGraphs, callback) {
  // Load the template
  var template = fs.readFileSync(__dirname + "/./reports/html_report.ejs", 'utf8');

  // Statistics
  var statistics = {};
  var fastStatistics = {};

  // Get the statistics for all series not server ops
  for(var name in logEntries) {
    if(name == 'server_monitoring') continue;
    // Add a statistical calculation
    statistics[name] = new RunningStats();
    fastStatistics[name] = new Stats();
    // Get timestamp measurements
    for(var time in logEntries[name]) {
      for(var i = 0; i < logEntries[name][time].length; i++) {
        statistics[name].push(logEntries[name][time][i].time);
        fastStatistics[name].push(logEntries[name][time][i].time);
      }
    }
  }

  // Read the schema
  var scenario = self.scenario;
  var schemas = {};

  // Pick out the runtime statistics
  for(var i = 0; i < scenario.schemas.length; i++) {
    var schema = scenario.schemas[i];
    schemas[schema.schema.name] = schema.execution.distribution;
  }

  // Render it with the passed in values
  var result = ejs.render(template, {
      entries: logEntries
    , schemaGraphs: schemaGraphs
    , serverGraphs: serverGraphs
    , title: self.argv.s
    , scenario: scenario
    , schemas: schemas
    , statistics: statistics
    , fastStatistics: fastStatistics
    , argv: self.monitor.argv
    , runtime: {
        processes: self.argv.n
        // Schemas
      , schemas: schemas
    }
  });

  // Write out to the output directory
  fs.writeFileSync(f('%s/index.html', self.argv.o), result, 'utf8');
  // We are done
  callback();
}

var BasicReport = function(monitor, filename) {
  this.monitor = monitor;
  this.filename = filename;
}

BasicReport.prototype.execute = function(callback) {
  var self = this;
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
  var db = levelup(f('%s/db', this.monitor.argv.o));
  var stream = db.createReadStream();
  stream.on('data', function(data) {
    var obj = JSON.parse(data.value);
    if(measurements[obj.tag] == null) measurements[obj.tag] = [];
    measurements[obj.tag].push(obj);
  });

  stream.on('end', function() {
    renderScenarios(self, measurements, function(err, scenarioHtml) {
      if(err) return callback(err);

      // Render topologies
      renderTopologies(self, topologyFeeds, function(err, topologyHtml) {
        if(err) return callback(err);

        // Merge the html report
        mergeReports(self, {scenarios:scenarioHtml, topologies: topologyHtml}, callback);
      });
    });    
  });
}

/*
 * Render the scenario data
 */
var renderScenarios = function(self, scenarios, callback) {
  var template = fs.readFileSync(__dirname + "/./templates/scenarios_template.ejs", 'utf8');
  // Log Entries empty
  var logEntries = {};
  var schemas = null;
  var statistics = {};
  var fastStatistics = {};
  var schemas = self.monitor.scenario.schemas;

  // Transform the data to be the count by timestamp
  var entries = {};

  // Calculate all the statistical values of the set
  for(var name in scenarios) {
    // Create new stats runners
    statistics[name] = new RunningStats();
    fastStatistics[name] = new Stats();
    // Add a new entries dialog to count all timestamp values
    if(entries[name] == null) entries[name] = {};

    // Get the measurements
    var measurements = scenarios[name];
    for(var i = 0; i < measurements.length; i++) {
      var timestamp = measurements[i].timestamp;
      var obj = measurements[i].object;
      
      // Add to statistics
      statistics[name].push(obj.time);
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
    , statistics: statistics
    , fastStatistics: fastStatistics
    , argv: self.monitor.argv
    , general: {
        startTimeMS: self.startTimeMS
      , endTimeMS: self.endTimeMS
      , totalTimeMS: self.totalTimeMS
    }
  });

  // Call back with results
  callback(null, html);
}

var mergeLogEntries = function(logEntries1, logEntries2) {
  for(var tag in logEntries2) {
    if(logEntries1[tag] == null) {
      logEntries1[tag] = logEntries2[tag];
    } else {
      // Iterate over all the timestamps
      for(var timestamp in logEntries2[tag]) {
        if(logEntries1[tag][timestamp] == null) {
          logEntries1[tag][timestamp] = logEntries2[tag][timestamp];
        } else {
          logEntries1[tag][timestamp] = logEntries1[tag][timestamp].concat(logEntries2[tag][timestamp]);
        }
      }
    }
  }

  return logEntries1;
}

/*
 * Render the topology data
 */
var renderTopologies = function(self, topologies, callback) {
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
  callback(null, html);
}

/*
 * Merge the html into a final report
 */
var mergeReports = function(self, entries, callback) {
  var template = fs.readFileSync(__dirname + "/./templates/merge_template.ejs", 'utf8');

  // Render the template
  var html = ejs.render(template, {
    entries: entries
  });

  // Write report out
  var filename = f('%s/index.html', self.monitor.argv.o);
  // Write data to disk
  fs.writeFileSync(filename, html, 'utf8');

  // Finished
  callback();
}

module.exports = BasicReport;
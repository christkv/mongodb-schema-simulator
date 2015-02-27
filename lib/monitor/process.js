var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode')
  , fs = require('fs')
  , ejs = require('ejs')
  , inherits = require('util').inherits
  , LocalAgentProcess = require('./local_agent')
  , ServerMonitor = require('./server_monitor')
  , MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter
  , RunningStats = require('./gnuplot/running_stats')
  , JSONStream = require('JSONStream')
  , gnuplot = require('./gnuplot/gnuplot');

/*
 * Monitor that coordinates all the child processes
 */
var Process = function(argv, manager, clients) {
  this.argv = argv;
  this.manager = manager;
  this.clients = clients;
  this.children = [];

  // Execution state
  this.registeredChildrenCount = 0;
  this.processesDoneCount = 0;
  this.results = [];
  this.errors = [];

  // Services
  this.services = {};

  // The scenario file
  var file = f('%s/%s', process.cwd(), this.argv.s);

  // Load the passed in scenario
  this.scenario = require(file);

  // Create the Server Monitor instance
  this.serverProcess = new ServerMonitor(this.scenario.url, 1000);

  // Contains the output data streams
  this.outputStreams = {};
}

inherits(Process, EventEmitter);

/*
 * Start the monitor
 */
Process.prototype.start = function(callback) {
  EventEmitter.call(this);
  var self = this;
  // Not running in local mode
  if(!this.argv.l) return callback();
  // Default child port
  var port = this.argv['local-process-port'];
  var url = this.argv['local-process-url'];

  // Load the scenario file
  var file = require(f('%s/%s', process.cwd(), this.argv.s));
  var numberOfProcesses = this.argv.n;

  // Calculate the total number of executions
  var totalExecutions = 0;

  // For each schema calculate the total
  for(var i = 0; i < file.schemas.length; i++) {
    var dist = file.schemas[i].execution.distribution;
    totalExecutions += (dist.iterations * dist.numberOfUsers * numberOfProcesses);
  }

  // Start the server monitor
  this.serverProcess.start(function(err) {
    if(err) return callback(err);

    // Kick off the processes
    for(var i = 0; i < self.argv.n; i++) {
      var child = new LocalAgentProcess(f('child_%s', i), url, self.argv.p, port++);
      // Save the child to the list of children
      self.children.push(child);
      // Start the child
      child.start();
    }

    // Return
    callback(null, {totalExecutions: totalExecutions});
  });

  // Add listener to server Process
  this.serverProcess.on('data', function(result) {
    if(self.outputStreams[result.name] == null) {
      var stream = JSONStream.stringifyObject('{\n', '\n,\n', '\n}\n');
      // Output file name
      var filename = f('%s/%s.json', self.argv.o, result.name);
      // Create writeable stream
      var file = fs.createWriteStream(filename);
      stream.pipe(file);

      // Save the stream
      self.outputStreams[result.name] = {
        stream: stream
      }
    }

    // Write to the file
    self.outputStreams[result.name].stream.write([result.timestamp, result]);
  });
}

Process.prototype.totalExecutions = function() {

}

Process.prototype.error = function(err) {
  console.log(f('[MONITOR] client signaled error %s', JSON.stringify(err)));
  this.emit('error', err);
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
 * Render the HTML report
 */
var renderHTMLReport = function(self, logEntries, schemaGraphs, serverGraphs, callback) {
  // Load the template
  var template = fs.readFileSync(__dirname + "/./reports/html_report.ejs", 'utf8');

  // Statistics
  var statistics = {};

  // Get the statistics for all series not server ops
  for(var name in logEntries) {
    if(name == 'server_monitoring') continue;
    // Add a statistical calculation
    statistics[name] = new RunningStats();
    // Get timestamp measurements
    for(var time in logEntries[name]) {
      for(var i = 0; i < logEntries[name][time].length; i++) {
        statistics[name].push(logEntries[name][time][i].time);
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
    , statistics: statistics
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

Process.prototype.done = function(results) {
  console.log(f('[MONITOR] client signaled done from child process %s:%s', results.host, results.port));
  // Unpack the results
  var host = results.host;
  var port = results.port;
  var logEntries = results.logEntries;
  var self = this;

  // Set the first logEntries or merge the new ones with the current one
  if(this.logEntries == null) {
    this.logEntries = logEntries;
  } else if(this.logEntries) {
    this.logEntries = mergeLogEntries(this.logEntries, logEntries);
  }

  // Update number of processes done
  this.processesDoneCount = this.processesDoneCount + 1;

  // Are we done ?
  if(this.processesDoneCount == this.children.length) {
    this.logEntries = mergeLogEntries(this.logEntries, this.serverProcess.logEntries);

    // Generate reports
    generateReport(self, this.logEntries, function() {
      self.emit('complete', self.logEntries);
    });
  }
}

Process.prototype.stop = function(signal, callback) {
  var self = this;
  if(typeof signal == 'function') callback = signal, signal = 'SIGTERM';
  var left = this.children.length;

  for (var i = this.children.length - 1; i >= 0; i--) {
    this.children[i].stop(signal, function() {
      left = left - 1;

      if(left == 0) {
        // Stop the server monitor
        self.serverProcess.stop(function() {

          // Close all write streams
          for(var name in self.outputStreams) {
            self.outputStreams[name].stream.end();
          }

          callback();
        });
      }
    });
  };
}

var finish = function(self) {

}

Process.prototype.register = function(client) {
  var found = false
  // We have enough children ignore any more incoming clients
  if(this.registeredChildrenCount == this.argv.n) return;
  console.log(f('[MONITOR] register execution process node %s:%s', client.hostname, client.argv.p));

  // Locate the matching child (if we have one)
  for(var i = 0; i < this.children.length; i++) {
    var child = this.children[i];

    if(child.tag == client.argv.t) {
      child.registerInfo = client;
      found = true;
      break;
    }
  }

  // Registered another child
  this.registeredChildrenCount = this.registeredChildrenCount + 1;
  // Do we have enough workers execute them
  if(this.registeredChildrenCount == this.argv.n) return this.execute();
}

var scenarioSetup = function(self, scenario, callback) {
  // Connect to mongodb
  MongoClient.connect(scenario.url, {
      server: { poolSize: 1 }
    , replSet: { poolSize: 1 }
    , mongos: { poolSize: 1 }
  }, function(err, db) {
    if(err) return callback(err);

    // How many schemas are left
    var left = scenario.schemas.length;
    var errors = [];

    // Execute the global schema setup
    var setupSchema = function(schema, callback) {
      console.log(f('[MONITOR] execute global scenarios setup for scenario %s %s', schema.schema.name, JSON.stringify(schema.schema.params)));
      // Fetch the scenario class
      var object = self.manager.find(schema.schema.name);
      // No scenario found return an error
      if(!object) return callback(new Error(f('could not find scenario instance for %s', schema.schema.name)));

      // Validate that all paramters are valid
      for(var name in schema.schema.params) {
        if(!object.params[name]) return callback(new Error(f('scenario %s does not support the parameter %s', schema.schema.name, name)));
      }

      if(typeof schema.setup == 'function') {
        schema.setup(db, function(err, r) {
          if(err) return callback(err);
          // Initiate an instance and call it
          object.create(self.services, scenario, schema).globalSetup(callback);
        });
      } else {
        // Initiate an instance and call it
        object.create(self.services, scenario, schema).globalSetup(callback);
      }
    }

    // Iterate over all the schemas
    for(var i = 0; i < scenario.schemas.length; i++) {
      setupSchema(scenario.schemas[i], function(err) {
        left = left - 1;
        if(err) errors.push(err);

        if(left == 0) {
          callback(errors.length > 0 ? errors : null);
        }
      });
    }
  });
}

Process.prototype.execute = function(callback) {
  console.log(f("[MONITOR] starting execution of provided scenario %s", this.argv.s));
  var file = f('%s/%s', process.cwd(), this.argv.s);
  var self = this;

  // Load the passed in scenario
  var scenario = self.scenario;
  var errors = [];
  var results = null;
  var left = this.children.length;

  // Perform scenario setup
  scenarioSetup(self, scenario, function(err) {
    if(err) throw err;

    // Call each child with the executor
    for(var i = 0; i < self.children.length; i++) {

      // Execute the scenario on the child process
      self.children[i].execute(scenario, {}, function(err, results) {
        left = left - 1;

        if(left == 0) {
          callback(errors.length > 0 ? errors : null, results);
        }
      });
    }
  });
}

module.exports = Process;

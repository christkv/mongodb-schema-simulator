var cp = require('child_process')
  , f = require('util').format
  , dnode = require('dnode')
  , fs = require('fs')
  , ejs = require('ejs')
  , inherits = require('util').inherits
  , ServerMonitor = require('./server_monitor')
  , MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter
  , gnuplot = require('../gnuplot/gnuplot');

/*
 * Monitor that coordinates all the child processes
 */
var Monitor = function(argv, manager, clients) {
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

  // Create the Server Monitor instance
  this.serverMonitor = new ServerMonitor(argv['local-process-url'], 1000);
}

inherits(Monitor, EventEmitter);

/*
 * Start the monitor
 */
Monitor.prototype.start = function(callback) {
  EventEmitter.call(this);
  var self = this;
  // Not running in local mode
  if(!this.argv.l) return callback();  
  // Default child port
  var port = this.argv['local-process-port'];
  var url = this.argv['local-process-url'];

  // Start the server monitor
  this.serverMonitor.start(function(err) {
    if(err) return callback(err);

    // Kick off the processes
    for(var i = 0; i < self.argv.n; i++) {
      var child = new LocalChild(f('child_%s', i), url, self.argv.p, port++);
      // Save the child to the list of children
      self.children.push(child);
      // Start the child
      child.start();
    }

    // Return
    callback();
  });
}

Monitor.prototype.totalExecutions = function() {
  
}

Monitor.prototype.error = function(err) {  
  console.log(f('[MONITOR] client signaled error'));
  // console.log(f('[MONITOR] register execution process node %s:%s', client.hostname, client.argv.p));
  this.errors.push(err);
  // Update number of processes done
  this.processesDoneCount = this.processesDoneCount + 1;
  // Are we done ?
  if(this.processesDoneCount == this.children.length) {
    this.emit('error')
  } 
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
    callback({
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
  var lastReading = data[calibrationKey][0];
  delete data[calibrationKey];

  // Resample the data to get actual ops pr
  for(var i = 0; i < keys.length; i++) {
    var original = data[keys[i]][0];
    // Adjust data
    data[keys[i]][0] = {
      "insert": original.insert - lastReading.insert,
      "query": original.query - lastReading.query,
      "update": original.update - lastReading.update,
      "delete": original.delete - lastReading.delete,
      "getmore": original.getmore - lastReading.getmore,
      "command": original.command - lastReading.command
    }
    
    // Make measure the last Reading
    lastReading = original;
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
  var fields = Object.keys(data[keys[0]][0]);
  var lines = [];

  // Iterate over all the fields
  for(var j = 0; j < fields.length; j++) {
    var n = fields[j];
    var entries = [];

    // Iterate over all the results
    for(var k = 0; k < keys.length; k++) {
      entries.push(data[keys[k]][0][n]);
    }

    // graphData.push(entries);
    graph.addData(entries);
  }

  // Create the descriptive lines
  for(var j = 0; j < fields.length; j++) {
    lines.push(f('"-" using 1:%s title "%s"', count++, fields[j]));
  }

  // Set the plot commands
  graph.plotData(lines);
  graph.execute(function() {
    callback({
        name:name
      , path: filename
      , filename: f('%s.png', name)
    });
  });
}

/*
 * Render the HTML report
 */
var renderHTMLReport = function(self, logEntries, graphs, callback) {
  // Load the template
  var template = fs.readFileSync(__dirname + "/../reports/html_report.ejs", 'utf8');
  // Render it with the passed in values
  var result = ejs.render(template, {
      entries: logEntries
    , graphs: graphs
    , title: self.argv.s
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
  var graphs = [];

  // Join up all generation
  var finish = function(data) {
    count = count - 1;

    // Save the returned data
    graphs.push(data);

    // We need to generate the actual report
    if(count == 0) {
      // Render the actual report
      renderHTMLReport(self, logEntries, graphs, callback)
    }
  }

  // Go over all the values
  for(var name in logEntries) {
    console.log(f('[MONITOR] generating graph for %s', name));

    // Check what type of data it is
    var data = logEntries[name];
    var keys = Object.keys(data);

    // Check if we have a op time recording
    if(keys.length > 0 && data[keys[0]][0].start && data[keys[0]][0].end && data[keys[0]][0].time) {
      generateOperations(self, name, data, finish);
    } else if(keys.length > 0 && data[keys[0]][0].insert && data[keys[0]][0].update && data[keys[0]][0].query) {
      generateServerOperations(self, name, data, finish);
    }
  }
}

Monitor.prototype.done = function(results) {  
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
    // Merge the server monitor results
    this.logEntries = mergeLogEntries(this.logEntries, this.serverMonitor.logEntries);

    // Generate reports
    generateReport(self, this.logEntries, function() {
      self.emit('complete', self.logEntries);
    });
  } 
}

Monitor.prototype.stop = function(signal, callback) {
  var self = this;
  if(typeof signal == 'function') callback = signal, signal = 'SIGTERM';
  var left = this.children.length;

  for (var i = this.children.length - 1; i >= 0; i--) {
    this.children[i].stop(signal, function() {
      left = left - 1;

      if(left == 0) {
        // Stop the server monitor
        self.serverMonitor.stop(function() {          
          callback();
        });
      }
    });
  };
}

var finish = function(self) {

}

Monitor.prototype.register = function(client) {
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
  MongoClient.connect(scenario.url, function(err, db) {
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

      // Initiate an instance and call it
      object.create(self.services, scenario, schema).globalSetup(callback);
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

Monitor.prototype.execute = function(callback) {
  console.log(f("[MONITOR] starting execution of provided scenario %s", this.argv.s));
  var file = f('%s/%s', process.cwd(), this.argv.s);
  var self = this;

  // Load the passed in scenario
  var scenario = require(file);
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

/*
 * Child process wrapper
 */
var LocalChild = function(tag, url, monitorPort, port) { 
  this.tag = tag;
  this.url = url;
  this.monitorPort = monitorPort;
  this.port = port;
  this.state = 'init';
  this.registerInfo = null;
}

/*
 * Execute scenario using a child process
 */
LocalChild.prototype.execute = function(scenario, options, callback) {
  var self = this;
  // Connect to the child process and execute the scenario
  var d = dnode.connect(this.port);
  d.on('remote', function(remote) {
    console.log(f("[MONITOR] executing scenario against local child process at %s:%s", self.registerInfo.hostname, self.port));
    remote.execute(scenario, options, function(err, results) {
      d.end();
    });
  });
}

/*
 * Stop the child process
 */
LocalChild.prototype.stop = function(signal, callback) {
  this.process.on('exit', callback);
  this.process.kill(signal);
}

/*
 * Start the local child process
 */
LocalChild.prototype.start = function() {
  var self = this;
  // For
  this.state = 'fork';
  // For the child
  this.process = cp.fork(__dirname + '/../../child.js', [
      '-p', self.port
    , '-m', self.monitorPort
    , '-u', self.url
    , '-t', self.tag]);
  
  // Receive message exit
  this.process.on('exit', function(code, signal) {
    self.state = 'exited';
  });

  // Receive message exit
  this.process.on('close', function(code, signal) {});

  // Receive error message
  this.process.on('error', function(err) {
    self.state = 'error';
  });
}

module.exports = Monitor;
















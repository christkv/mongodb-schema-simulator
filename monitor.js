"use strict"

var f = require('util').format,
  fs = require('fs'),
  co = require('co'),
  mkdirp = require('mkdirp'),
  Monitor = require('./lib/monitor'),
  Table = require('cli-table'),
  ProgressBar = require('progress');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Start a the main process.\nUsage: $0')
  .example('$0 -p 5100', 'Run client on port 5100')
  // The Monitor process port
  .describe('p', 'Port process is running on')
  .default('p', 5100)
  // Number of processes to use in the execution
  .describe('n', 'Number of processes running')
  .default('n', 2)
  // Run all the processes locally
  .describe('r', 'Remote agent processes, wait for enough to connect before executing')
  .default('r', false)
  // Local process starting port
  .describe('local-process-port', 'Local process start port')
  .default('local-process-port', 5200)
  // The scenario file to execute
  .describe('s', 'Path to scenario file to execute')
  .required('s')
  // The scenario file to execute
  .describe('debug', 'Run with debug enables')
  .default('debug', false)
  // Output directory of the processes
  .describe('o', 'Results output directory')
  .default('o', './out')
  // Target Topology url
  .describe('url', 'mongodb url')
  .default('url', 'mongodb://localhost:27017/test?maxPoolSize=50')

// Get parsed arguments
var argv = yargs.argv

// Create options for the monitor process
var options = {
  // The monitor process ports
    host: 'localhost'
  , port: argv.p
  // Actual simulation scenario to execute
  , simulationPath: argv.s
  // The mongodb cluster url
  , url: argv.url
  // Running a local agent (if -r flag not provided)
  , runningLocalAgents: !argv.r
  // Number of agents to use in simulation (either local or remote ones)
  , number: argv.n
  // The local agent start port
  , agentStartPort: argv['local-process-port']
  // Output of collected metrics
  , output: argv.o
}

options.simulationPath = f('%s/%s', __dirname, options.simulationPath)

// First create the output directory
mkdirp.sync(options.output);

// Get the progress bar
var bar = null;
var total = 0;
var count = 0;

// Execute the monitor
co(function*() {
  var monitor = new Monitor(options);
  
  // Wait for done event
  monitor.on('done', function() {
    process.exit(0);
  });

  // Total operations
  monitor.on('status', function(ops) {
    total = total + ops.ops;
  });

  monitor.on('execute', function() {});

  // Get the count of measurements done
  monitor.on('tick', function(ticks) {
    if(count == 0) {
      bar = new ProgressBar('  executing [:bar] [:current/:total] :etas', {
            complete: '='
          , incomplete: ' '
          , width: 60
          , total: total
        }
      );      
    }

    // Skip if we reached the total
    if(count >= total) return;

    // Add the ticks
    for(var i = 0; i < ticks; i++) {
      // Skip if we reached the total
      if(count == total) return;
      // Tick
      bar.tick();
      // Add one to the count of ops
      count = count + 1;
    }
  });

  // Start the monitor
  yield monitor.start();
}).catch(function(err) {
  console.dir(err)
});


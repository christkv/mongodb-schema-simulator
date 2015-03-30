var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , mkdirp = require('mkdirp')
  , levelup = require('levelup')  
  , SingleRun = require('./lib/monitor/single_run')
  , Optimizer = require('./lib/monitor/optimizer')
  , Process = require('./lib/monitor/process')
  , ScenarioManager = require('./lib/common/scenario_manager')
  , ProgressBar = require('progress');

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
  // The scenario file to execute
  .describe('debug', 'Run with debug enables')
  .default('debug', false)
  // Output directory of the processes
  .describe('o', 'Results output directory')
  .default('o', './out')
  // Generate report only
  .describe('g', 'Re-generate report from data')
  .default('g', false)
  // Target Topology url
  .describe('url', 'mongodb url')
  .default('url', 'mongodb://localhost:27017/test?maxPoolSize=50')
  // Find maximum continous throughput
  .describe('optimize', 'optimize the load so total runtime equals the number of iterations')
  .default('optimize', false)
  // Optimize margin
  .describe('optimize-margin', 'margin in % to optimize against (lower/upper) bound')
  .default('optimize-margin', 20)

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Error out as no scenario has been specified
if(typeof argv.s != 'string') 
  return console.log('[MONITOR] no scenario specified');

// Create the output directory
mkdirp.sync(argv.o);

// Scenario manager
var manager = new ScenarioManager().load('./lib/common/scenarios');
// Create 
var runner = argv.optimize 
  ? new Optimizer(argv, manager)
  : new SingleRun(argv, manager);

// We are not doing anything but regenerating the report
if(argv.g) return runner.report(function() {});

// Set up listeners
runner.on('end', function() {
  // Execute report
  runner.report(function() {
    process.exit(0);
  });
});

runner.on('reportDone', function() {
  process.exit(0);
});

runner.on('error', function() {
  process.exit(0);
});

// Execute the process
runner.execute();
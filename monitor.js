var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , path = require('path')
  , mkdirp = require('mkdirp')
  , levelup = require('levelup')  
  , SingleRun = require('./lib/monitor/single_run')
  , Optimizer = require('./lib/monitor/optimizer')
  , Process = require('./lib/monitor/process')
  , ScenarioManager = require('./lib/common/scenario_manager')
  , Table = require('cli-table')
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
  // Generation db used
  .describe('report-db-path', 'Report db to use for report')
  .default('report-db-path', null)
  // Target Topology url
  .describe('url', 'mongodb url')
  .default('url', 'mongodb://localhost:27017/test?maxPoolSize=50')
  // List all available scenarios
  .describe('scenarios', 'list all available scenarios')
  .default('scenarios', null)
  // 
  // Optimizer methods
  // Find maximum continous throughput
  .describe('optimize', 'optimize the load so total runtime equals the number of iterations')
  .default('optimize', false)
  // Optimize margin
  .describe('optimize-margin', 'margin in % to optimize against (lower/upper) bound')
  .default('optimize-margin', 20)
  // Optimization mode
  .describe('optimize-mode', 'mode of optimization. One of total-time or latency')
  .default('optimize-mode', 'total-time')
  // Optimization mode
  .describe('optimize-percentile', 'the percentile to optimize against the timing resolution')
  .default('optimize-percentile', 99)
  // Optimize against latency
  .describe('optimize-latency-target', 'The latency target for each operation')
  .default('optimize-latency-target', 100)  
  // Optimize 
  .describe('optimize-for-scenario', 'Optimize for a specific scenario, picks the first one if none specified')
  .default('optimize-for-scenario', null)  

// Get parsed arguments
var argv = yargs.argv

// List all scenarios
var listScenarios = function(scenario, manager) {
  // No paramter passed in
  if(scenario == true) {
    var scenarios = manager.list();
    var table = new Table({
        head: ['Scenario name', 'Scenario description']
      , colWidths: [50, 75]
    });

    // Iterate over all the scenarios
    for(var i = 0; i < scenarios.length; i++) {
      // console.dir(scenarios[i])
      table.push([scenarios[i].name, scenarios[i].description]);
    }

    // Print the table
    console.log(table.toString());    
  } else if(manager.find(scenario)) {
    var scenario = manager.find(scenario);
    console.log(JSON.stringify(scenario, null, 2))
  } else {
    console.log(f("could not locate scenario with name %s", scenario));
  }
}

// List help
if(argv.h) return console.log(yargs.help())

// Scenarios Directory
var scenariosDirectory = path.resolve(__dirname, f('%s', './lib/common/scenarios'));
// Create a scenario manager
var manager = new ScenarioManager().load(scenariosDirectory);

// List all scenarios
if(argv.scenarios) {
  return listScenarios(argv.scenarios, manager);
}

// Error out as no scenario has been specified
if(typeof argv.s != 'string') 
  return console.log('[MONITOR] no scenario specified');

// Create the output directory
mkdirp.sync(argv.o);

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
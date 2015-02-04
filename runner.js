var f = require('util').format
  , fs = require('fs')
  , dnode = require('dnode')
  , mkdirp = require('mkdirp')
  , Monitor = require('./lib/monitor/monitor')
  , ScenarioManager = require('./lib/child/scenario_manager')
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
  .describe('l', 'Run all client processes locally')
  .default('l', true)
  // Local process starting port
  .describe('local-process-port', 'Local process start port')
  .default('local-process-port', 5200)
  // Local MongoDB process url
  .describe('local-process-url', 'Local process MongoDB url')
  .default('local-process-url', 'mongodb://localhost:27017/schema')
  // The scenario file to execute
  .describe('s', 'Path to scenario file to execute')
  .require('s')
  // The scenario file to execute
  .describe('debug', 'Run with debug enables')
  .default('debug', false)
  // Output directory of the processes
  .describe('o', 'Results output directory')
  .default('o', './out')

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Create the output directory
mkdirp.sync(argv.o);

// Scenario manager
var manager = new ScenarioManager();
// Load the scenarios
manager.load('./lib/scenarios');
// Var clients
var clients = [];
// Monitor instance
var monitor = new Monitor(argv, manager, clients);
// Get the total amount of work needed
var totalExecutions = 0;
var executionsLeft = 0;
var bar = null;

// The actual server (handles clients reporting back)
var server = dnode({
  // Registration call from the client process
  register: function(client, callback) {
    monitor.register(client)
    callback();
  },
  // Error from the client process
  error: function(err, callback) {
    monitor.error(err);
    callback();
  },  
  // Results from a client process
  done: function(results, callback) {
    monitor.done(results);
    callback();
  },
  // Reports the number of items we are executing for all jobs
  setup: function(data, callback) {
    // Setup the number of executions left to perform
    totalExecutions = totalExecutions + data.totalExecutions;
    executionsLeft = totalExecutions;
    // Finish
    callback();
  },
  // A work unit was finished
  tick: function(callback) {
    if(bar == null) bar = new ProgressBar('  executing [:bar] [:current/:total] :etas', { 
          complete: '='
        , incomplete: ' '
        , width: 60
        , total: totalExecutions 
      }
    );
    executionsLeft = executionsLeft - 1;
    bar.tick();
    // console.log(f('%s of %s left', executionsLeft, totalExecutions));
    callback();
  } 
});

// Wait for all children to be setup
monitor.on('registrationComplete', function() {
  monitor.execute();
});

// Wait for the scenario to finish executing
monitor.on('complete', function(logEntries) {
  console.log("[MONITOR] Executon finished, stopping child processes");
  // Split out the scenario name
  var scenarioFile = argv.s.split('/').pop();
  var outputFile = f('%s/%s.output.json', argv.o, scenarioFile);
  // Write out the file
  fs.writeFileSync(outputFile, JSON.stringify(logEntries, null, 2));

  // Stop the monitor
  monitor.stop(function() {
    console.log("[MONITOR] Executon finished, stopping dnode server endpoint");
    // Stop the dnode server
    server.end();
    // Stop the process
    process.exit(0);
  });
});

// In case the scenario failed to execute
monitor.on('error', function() {

});

// Run the monitor listening point
server.listen(argv.p, function() {
  // Start the monitor
  monitor.start(function(err) {
    if(err) throw err;
  });
});


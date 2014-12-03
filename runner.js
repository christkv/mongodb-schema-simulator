// // Parse arguments
var f = require('util').format
  , Executor = require('./lib/parent/executor');

var yargs = require('yargs')
  .usage('Count the lines in a file.\nUsage: $0')
  .example('$0 -u mongodb://localhost:27017/test -e embedded_growing_list', 'Run a specific example against MongoDB')
  // URI Setting
  .describe('u', 'MongoDB connection URI')
  .default('u', 'mongodb://localhost:27017/benchmark')
  // Example to run
  .describe('e', 'MongoDB example to run')
  .require('e')
  // Method to run
  .describe('m', 'Method to run')
  .require('m')
  // Method to run
  .describe('d', 'Directory to put sampled data')
  .default('d', './tmp')
  // Method to run
  .describe('x', 'Remove the sampled data directory')
  .default('x', false)
  // List all available simulations
  .describe('l', 'List available examples')
  // List help
  .describe('h', 'List help screen')
  // Number of concurrent node processes to run
  .describe('p', 'Number of processes running')
  .default('p', 1)
  // Number of runs of the method
  .describe('r', 'Number of runs')
  .default('r', 1000)
  // Parallel execution
  .describe('c', 'Concurrency per process')
  .default('c', 5)

// Get parsed arguments
var argv = yargs.argv
// List help
if(argv.h) return console.log(yargs.help())

// All the simulations available
var moduleFiles = [
  __dirname + '/chapters/chapter_2/embedded.js'
]

// Resolve all the simulations
var modules = moduleFiles.map(function(x) {
  return require(x);
});

// List all the Modules available
if(argv.l) {
  var Table = require('cli-table');
  var table = new Table({ 
      head: ["Example", "Method", "Description"] 
    , colWidths: [25, 25, 82]
  });
  modules.forEach(function(x) {
    var displayed = false;

    x.methods.forEach(function(m) {
      var name = !displayed ? x.abr : '';
      displayed = true;
      var row = {};
      row[name] = [];
      row[name].push(m.name)
      row[name].push(m.description)
      table.push(row)
    });
  });

  console.log(table.toString());
}

// Load the module we wish to run
for(var i = 0; i < modules.length; i++) {
  if(modules[i].abr == argv.e) {
    // Create the executor
    var executor = new Executor(argv, modules[i]);
    // Execute the module
    executor.execute();
  }
}




























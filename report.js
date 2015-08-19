"use strict"

var f = require('util').format,
  fs = require('fs'),
  co = require('co'),
  mkdirp = require('mkdirp'),
  Report = require('./lib/report');

// Parse the passed in parameters
var yargs = require('yargs')
  .usage('Generate a report.\nUsage: $0')
  .example('$0 -p 5100', 'Run client on port 5100')
  // Database path
  .describe('db-path', 'Database path')
  .default('db-path', './out/db')
  // Report output path
  .describe('output-path', 'Report output path')
  .default('output-path', './out')
  // Path to report.json file
  .describe('report-file', 'Path to report.json file')
  .default('report-file', './out/report.json')
  // Report output file name
  .describe('report-output-filename', 'Report output file name')
  .default('report-output-filename', 'index.html')
  // Alias help
  .alias('h', 'help')

// Get parsed arguments
var argv = yargs.argv

// List help
if(argv.h) return console.log(yargs.help())

// Create options for the monitor process
var options = {
  filename: argv['report-file'],
  dbPath: argv['db-path'],
  output: argv['output-path'],
  outputFilename: argv['report-output-filename']
}

// First create the output directory
try {
  mkdirp.sync(options.output);  
} catch(err) {
  console.log(err.stack);
}

// Execute the monitor
co(function*() {
  // Create a new report
  var report = new Report(options);
  // Execute the report
  yield report.execute();
}).catch(function(err) {
  console.log(err.stack)
});


var es = require('event-stream')
  , stream = require('stream')
  , datasets = require('mongodb-datasets');

var Services = function(argv, manager) {
  this.argv = argv;
  this.manager = manager;
  // All the entries
  this.logEntries = {};
  // Current second timestamp
  this.currentSecondTimestamp = null;
  // Current minute timestamp
  this.currentMinuteTimestamp = null;
}

Services.prototype.log = function(resolution, tag, object) {
  if(this.logEntries[tag] == null) this.logEntries[tag] = {};

  // Set a new second timestamp
  if(this.currentSecondTimestamp == null) {
    this.currentSecondTimestamp = new Date();
    this.currentSecondTimestamp.setMilliseconds(0);
  } else {
    var timestamp = new Date();
    timestamp.setMilliseconds(0);
    // If we have a new second adjust the current timestamp
    if(timestamp.getTime() > this.currentSecondTimestamp.getTime()) {
      this.currentSecondTimestamp = timestamp;
    }
  }

  // Add the current log statement
  if(this.logEntries[tag][this.currentSecondTimestamp.getTime()] == null) {
    this.logEntries[tag][this.currentSecondTimestamp.getTime()] = [];
  }

  // Push the logged item
  this.logEntries[tag][this.currentSecondTimestamp.getTime()].push(object);
}

Services.prototype.generateObjectFromTemplate = function(template, callback) {
  // Create a readable stream to pipe into generator
  var s = new stream.Readable();
  // s._read = function noop() {}; // redundant? see update below
  s.push(template);
  s.push(null);

  // Generate the document
  s.pipe(datasets.createGeneratorStream({size: 1}))
   .pipe(es.writeArray(function(err, array) {
     callback(null, array[0]);
   }));
}

module.exports = Services;

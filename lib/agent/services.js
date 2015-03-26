var es = require('event-stream')
  , os = require('os')
  , stream = require('stream')
  , datasets = require('mongodb-datasets');

var Services = function(argv, manager, monitor) {
  this.argv = argv;
  this.manager = manager;
  this.monitor = monitor;
  // All the entries
  this.logEntries = {};
  // Current second timestamp
  this.currentSecondTimestamp = null;
  // Current minute timestamp
  this.currentMinuteTimestamp = null;
  // Current cache of operations
  this.opCacheEntriesMax = 500;
  this.opCache = [];
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

  // If we are done
  if(this.opCache.length < this.opCacheEntriesMax) {
    this.opCache.push({
        host: os.hostname()
      , port: this.argv.p
      , tag: tag
      , timestamp: this.currentSecondTimestamp.getTime()
      , object: object
    });
  } else if(this.opCache.length == this.opCacheEntriesMax) {
    // Send the entry to the monitor
    this.monitor.log(this.opCache, function(err) {});    
    this.opCache = [];
  }
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

Services.prototype.generateObjectsFromTemplate = function(template, number, callback) {
  // Create a readable stream to pipe into generator
  var s = new stream.Readable();
  // s._read = function noop() {}; // redundant? see update below
  s.push(template);
  s.push(null);

  // Generate the document
  s.pipe(datasets.createGeneratorStream({size: number}))
   .pipe(es.writeArray(function(err, array) {
     callback(null, array);
   }));
}

module.exports = Services;

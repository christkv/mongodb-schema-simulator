var MongoClient = require('mongodb').MongoClient;

var ServerMonitor = function(url, resolution) {
  this.url = url;
  this.resolution = resolution;
  this.logEntries = {
    server_monitoring: {}
  };
}

ServerMonitor.prototype.start = function(callback) {  
  var self = this;
  // Connect to the mongodb cluster (just supporting single server monitoring right now)
  MongoClient.connect(this.url, function(err, db) {
    if(err) return callback(err);
    self.db = db;

    // Start up the interval checking
    self.interval = setInterval(function() {
      // Execute command
      self.db.command({serverStatus:true}, function(err, r) {
        if(!err) {
          // Create second based timetamp
          var timestamp = new Date();
          timestamp.setMilliseconds(0)

          // Create an entry for the second if none exists
          if(self.logEntries['server_monitoring'][timestamp.getTime()] == null) {
            self.logEntries['server_monitoring'][timestamp.getTime()] = [];
          }

          // Push the reading
          self.logEntries['server_monitoring'][timestamp.getTime()].push(r.opcounters);
        }
      });
    }, self.resolution);
  });
}

ServerMonitor.prototype.stop = function(callback) {  
  if(self.interval) clearInterval(self.interval);
  if(self.db) self.db.close();
  callback();
}


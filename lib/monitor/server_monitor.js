var MongoClient = require('mongodb').MongoClient;

var ServerMonitor = function(url, resolution) {
  this.url = url;
  this.resolution = resolution;
  this.db = null;
  this.logEntries = {
    server_monitoring: {}
  };
}

ServerMonitor.prototype.start = function(callback) {  
  console.log("[MONITOR] Start the server monitor process");
  var self = this;
  // Connect to the mongodb cluster (just supporting single server monitoring right now)
  MongoClient.connect(this.url, function(err, db) {
    callback(err);
    self.db = db;

    // Execute command to get calibration record
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
        r.opcounters.host = r.host;
        self.logEntries['server_monitoring'][timestamp.getTime()].push(r.opcounters);
      }

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
            r.opcounters.host = r.host;
            self.logEntries['server_monitoring'][timestamp.getTime()].push(r.opcounters);
          }
        });
      }, self.resolution);
    });
  });
}

ServerMonitor.prototype.stop = function(callback) {  
  if(this.interval) clearInterval(this.interval);
  if(this.db) this.db.close();
  callback();
}

module.exports = ServerMonitor;
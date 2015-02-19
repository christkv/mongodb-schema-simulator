var MongoClient = require('mongodb').MongoClient
  , Server = require('mongodb').Server
  , ReplSet = require('mongodb').ReplSet
  , Mongos = require('mongodb').Mongos
  , Db = require('mongodb').Db
  , f = require('util').format;

var ServerMonitor = function(url, resolution) {
  this.url = url;
  this.resolution = resolution;
  this.logEntries = {
    server_monitoring: {}
  };
}

/*
 * Monitor a single server
 */
var monitorServer = function(self, db, callback) {
  // Execute command to get calibration record
  db.command({serverStatus:true}, function(err, r) {
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
      db.command({serverStatus:true}, function(err, r) {
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
}

// 
// Locate all candidate servers for monitoring in set
var locateMonitoringServers = function(db, servers, errors, callback) {
  // Execute command to get calibration record
  db.command({ismaster:true}, function(err, r) {
    if(err) return callback(err);
    // Get all the servers
    var totalLeft = r.hosts.length;

    // Get all the hosts and create a connection for each
    for(var i = 0; i < r.hosts.length; i++) {
      // Get the parts
      var parts = r.hosts[i].split(/:/);
      parts[1] = parseInt(parts[1], 10);
      // Create a new db instance for this server
      var d = new Db(db.databaseName, new Server(parts[0], parts[1]));
      d.open(function(err, d1) {
        // We have an error
        if(err) {
          errors.push(err);
          totalLeft = totalLeft - 1;

          // Total servers left to check
          if(totalLeft == 0) {
            callback(errors.length > 0 ? errors : null);
          }
        }

        // Run ismaster
        d1.command({ismaster: true}, function(err, r) {
          totalLeft = totalLeft - 1;
          if(err) errors.push(err);

          // Server we need to monitor
          if(r.ismaster || r.secondary) servers.push(d1);

          // Total servers left to check
          if(totalLeft == 0) {
            callback(errors.length > 0 ? errors : null);
          }
        });
      });
    }
  });
}

//
// Get the statistics for a server
var executeOnServers = function(logEntries, name, server) {
  if(logEntries[name] == null) logEntries[name] = {};

  // Execute command
  server.command({serverStatus:true}, function(err, r) {
    if(!err) {
      // Create second based timetamp
      var timestamp = new Date();
      timestamp.setMilliseconds(0)

      // Create an entry for the second if none exists
      if(logEntries[name][timestamp.getTime()] == null) {
        logEntries[name][timestamp.getTime()] = [];
      }

      // Push the reading
      r.opcounters.host = r.host;
      // console.dir(r.opcounters)
      logEntries[name][timestamp.getTime()].push(r.opcounters);
    }
  });
}

/*
 * Monitor a replicaset server set
 */
var monitorReplicaSet = function(self, db, callback) {
  // All active connections
  var servers = [];
  var errors = [];

  // Monitor all the servers
  var monitorServers = function(servers) {
    // Start up the interval checking
    self.interval = setInterval(function() {
      // Iterate over all the servers
      for(var i = 0; i < servers.length; i++) {
        executeOnServers(self.logEntries, 'server_monitoring', servers[i]);
      }
    }, self.resolution);
  }

  // Get the candidate servers
  locateMonitoringServers(db, servers, errors, function(err) {
    if(err) return callback(err);
    monitorServers(servers);
  });
}

/*
 * Monitor a sharded system
 */
var monitorShard = function(self, db, callback) {
  // Execute command to get calibration record
  db.command({serverStatus:true}, function(err, r) {
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

    // Get the actual shard configurations
    db.db('config').collection('shards').find({}).toArray(function(err, shards) {
      if(err) return callback(err);

      // Shard connections
      var shardConnections = [];
      var left = shards.length;
      var errors = [];

      // Connect to the shard
      var connectToShard = function(shard, callback) {
        var shard = shards[i];
        var hosts = shard.host.split('/')[1];

        // Shard info
        var shardInfo = {_id: shard._id, servers: []};
        
        // Attempt to connect to all of the shards directly
        MongoClient.connect(f('mongodb://%s/%s', hosts, db.databaseName), function(err, _db) {          
          // Handle any error
          if(err) return callback(err);

          // Locate all the servers
          locateMonitoringServers(_db, shardInfo.servers, errors, function(err) {
            if(err) return callback(err);
            return callback(null, shardInfo);
          });
        });
      };

      // Create connections for each shard
      for(var i = 0; i < shards.length; i++) {
        // Connect to the shard
        connectToShard(shards[i], function(err, shardInfo) {
          left = left - 1;

          if(err) {
            errors.push(err)
          } else {
            shardConnections.push(shardInfo);
          }

          // No more shards to connect to
          if(left == 0) {
            if(errors.length > 0) return callback(errors);

            // Start up the interval checking
            self.interval = setInterval(function() {

              // Execute command against mongos
              db.command({serverStatus:true}, function(err, r) {
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

              // Collect the data on the shard
              var executeShard = function(shardInfo) {
                var servers = shardInfo.servers;
                var _id = shardInfo._id;

                // Iterate over all the servers
                for(var i = 0; i < servers.length; i++) {
                  executeOnServers(self.logEntries, _id, servers[i]);
                }                
              }

              // For each of the shards execute the gathering of the data
              for(var i = 0; i < shardConnections.length; i++) {
                executeShard(shardConnections[i]);
              }
            }, self.resolution);
          }
        });
      }
    });
  });
}

ServerMonitor.prototype.start = function(callback) {  
  // console.log("[MONITOR] Start the server monitor process");
  var self = this;
  // Connect to the mongodb cluster (just supporting single server monitoring right now)
  MongoClient.connect(this.url, {
    server: {poolSize:1}
  }, function(err, db) {
    callback(err);

    // Let's establish what kind of topology we have
    if(db.serverConfig instanceof Server) {
      monitorServer(self, db, callback);
    } else if(db.serverConfig instanceof ReplSet) {
      monitorReplicaSet(self, db, callback);
    } else if(db.serverConfig instanceof Mongos) {
      monitorShard(self, db, callback);
    }
  });
}

ServerMonitor.prototype.stop = function(callback) {  
  if(this.interval) clearInterval(this.interval);
  if(this.db) this.db.close();
  callback();
}

module.exports = ServerMonitor;
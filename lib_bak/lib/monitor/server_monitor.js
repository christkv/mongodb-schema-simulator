"use strict";

var MongoClient = require('mongodb').MongoClient
  , EventEmitter = require('events').EventEmitter
  , Server = require('mongodb').Server
  , ReplSet = require('mongodb').ReplSet
  , Mongos = require('mongodb').Mongos
  , co = require('co')
  , Db = require('mongodb').Db
  , inherits = require('util').inherits
  , f = require('util').format;

/*
 * Monitor a single server
 */
var monitorServer = function(self, db) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Execute command to get calibration record
      var r = yield db.command({serverStatus:true});
      // Create second based timetamp
      var timestamp = new Date();
      timestamp.setMilliseconds(0)

      // Emit the data
      self.emit('data', {
          name: 'server'
        , topology: 'single'
        , server: r.host
        , timestamp: timestamp
        , result: r
      });

      // Start up the interval checking
      self.interval = setInterval(function() {
        co(function*() {
          // Execute command
          var r = yield db.command({serverStatus:true});
          // Create second based timetamp
          var timestamp = new Date();
          timestamp.setMilliseconds(0)
          // Emit the data
          self.emit('data', {
              name: 'server'
            , topology: 'single'
            , server: r.host
            , timestamp: timestamp
            , result: r
          });
        }).catch(function(err) { reject(err); });
      }, self.resolution);

      // Resolve the promise
      resolve();
    }).catch(function(err) { reject(err); });
  });
}

//
// Locate all candidate servers for monitoring in set
var locateMonitoringServers = function(db, servers, errors) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Execute command to get calibration record
      var r = yield db.command({ismaster:true});
      // Get all the hosts and create a connection for each
      for(var i = 0; i < r.hosts.length; i++) {
        // Get the parts
        var parts = r.hosts[i].split(/:/);
        parts[1] = parseInt(parts[1], 10);

        // Create a new db instance for this server
        var d = new Db(db.databaseName, new Server(parts[0], parts[1]));
        var d1 = yield db.open();

        // Run ismaster
        var r = yield d1.command({ismaster: true});
        // Server we need to monitor
        if(r.ismaster || r.secondary) servers.push(d1);
      }

      resolve(r);
    }).catch(function(err) { reject(err); });
  });
}

//
// Get the statistics for a server
var executeOnServers = function(self, name, server) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      var r = yield server.command({serverStatus:true});
      // Create second based timetamp
      var timestamp = new Date();
      timestamp.setMilliseconds(0)
      // Emit the data
      self.emit('data', {
          name: name
        , topology: 'replicaset'
        , server: r.host
        , timestamp: timestamp
        , result: r
      });
    }).catch(function(err) { reject(err); });
  });
}

/*
 * Monitor a replicaset server set
 */
var monitorReplicaSet = function(self, db, callback) {
  var self = this;
  // All active connections
  var servers = [];
  var errors = [];

  return new Promise(function(resolve, reject) {
    co(function*() {
      // Monitor all the servers
      var monitorServers = function(servers, ismaster) {
        // Start up the interval checking
        self.interval = setInterval(function() {
          co(function*() {
            // Iterate over all the servers
            for(var i = 0; i < servers.length; i++) {
              yield executeOnServers(self, ismaster.setName, servers[i]);
            }
          });
        }, self.resolution);
      }

      // Get the candidate servers
      var ismaster = yield locateMonitoringServers(db, servers, errors);
      // Go through all the servers
      monitorServers(servers, ismaster);
      resolve();
    }).catch(function(err) { reject(err); });
  });
}

/*
 * Monitor a sharded system
 */
var monitorShard = function(self, db) {
  return new Promise(function(resolve, reject) {
    co(function*() {
      // Execute command to get calibration record
      var r = yield db.command({serverStatus:true});
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

      // Get the actual shard configurations
      var shards = yield db.db('config').collection('shards').find({}).toArray();

      // Shard connections
      var shardConnections = [];
      var left = shards.length;
      var errors = [];

      // Connect to the shard
      var connectToShard = function(shard) {
        return new Promise(function(resolve, reject) {
          co(function*() {
            var shard = shards[i];
            var hosts = shard.host.split('/')[1];

            // Shard info
            var shardInfo = {_id: shard._id, servers: []};

            // Attempt to connect to all of the shards directly
            var _db = yield MongoClient.connect(f('mongodb://%s/%s', hosts, db.databaseName));

            // Locate all the servers
            yield locateMonitoringServers(_db, shardInfo.servers, errors);
            resolve(shardInfo);
          });
        }).catch(function(err) { reject(err); });
      };

      // Create connections for each shard
      for(var i = 0; i < shards.length; i++) {
        // Connect to the shard
        var shardInfo = yield connectToShard(shards[i]);
        shardConnections.push(shardInfo);

        // Start up the interval checking
        self.interval = setInterval(function() {
          co(function*() {
            // Execute command against mongos
            var r = yield db.command({serverStatus:true});
            // Create second based timetamp
            var timestamp = new Date();
            timestamp.setMilliseconds(0)
            // Emit the data
            self.emit('data', {
                name: 'mongos'
              , server: r.host
              , topology: 'mongos'
              , timestamp: timestamp
              , result: r
            });

            // Collect the data on the shard
            var executeShard = function(shardInfo) {
              return new Promise(function(resolve, reject) {
                co(function*() {
                  var servers = shardInfo.servers;
                  var _id = shardInfo._id;

                  // Iterate over all the servers
                  for(var i = 0; i < servers.length; i++) {
                    yield executeOnServers(self, _id, servers[i]);
                  }

                  resolve();
                }).catch(function(err) { reject(err); });
              });
            }

            // For each of the shards execute the gathering of the data
            for(var i = 0; i < shardConnections.length; i++) {
              yield executeShard(shardConnections[i]);
            }
          });
        }, self.resolution);
      }

      resolve();
    }).catch(function(err) { reject(err); });
  });
}

/*
 * Server monitor
 */
class ServerMonitor extends EventEmitter {
  constructor(url, resolution) {
    super();
    // Save the parameters
    this.url = url;
    this.resolution = resolution;
    this.logEntries = {
      server_monitoring: {}
    };
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Connect to the mongodb cluster (just supporting single server monitoring right now)
        var db = yield MongoClient.connect(self.url, {
          server: {poolSize:1}
        });

        // Let's establish what kind of topology we have
        if(db.serverConfig instanceof Server) {
          yield monitorServer(self, db);
        } else if(db.serverConfig instanceof ReplSet) {
          yield monitorReplicaSet(self, db);
        } else if(db.serverConfig instanceof Mongos) {
          yield monitorShard(self, db);
        }

        resolve();
      }).catch(function(err) { reject(err); });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        if(self.interval) clearInterval(self.interval);
        if(self.db) self.db.close();
        resolve();
      }).catch(function(err) { reject(err); });
    });
  }
}

module.exports = ServerMonitor;

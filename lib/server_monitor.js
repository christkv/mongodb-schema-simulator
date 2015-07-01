"use strict";

var co = require('co'),
  f = require('util').format,
  EventEmitter = require('events').EventEmitter,
  MongoClient = require('mongodb').MongoClient,
  Server = require('mongodb').Server,
  ReplSet = require('mongodb').ReplSet,
  Mongos = require('mongodb').Mongos,
  Db = require('mongodb').Db;

class ServerMonitor extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    // MongoDB url
    this.url = options.url || 'mongodb://localhost:27107/load?maxPoolSize=1';
    // Replace a maxPoolSize of 50
    this.url = this.url.replace(/maxPoolSize=[0-9]+/, 'maxPoolSize=1');
    // Monitoring interval in MS
    this.interval = options.interval || 1000;
    this.intervalId = null;
    // Monitor object
    this.monitor = null;
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        self.db = yield MongoClient.connect(self.url, {
          server: {poolSize:1}
        });

        // Let's establish what kind of topology we have
        if(self.db.serverConfig instanceof Server) {
          self.monitor = new SingleServerMonitor(self.db, self.interval);
        // } else if(db.serverConfig instanceof ReplSet) {
        //   yield self.monitorReplicaSet();
        // } else if(db.serverConfig instanceof Mongos) {
        //   yield self.monitorShard();
        }

        // Add listener
        self.monitor.on('data', function(data) { self.emit('data', data); });

        // Start the monitor
        yield self.monitor.start();
        resolve();
      }).catch(function(err) {
        console.log(err.stack)
        reject(err);
      });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        yield self.monitor.stop();
        resolve();
      }).catch(reject);
    });
  }
}

class SingleServerMonitor extends EventEmitter {
  constructor(db, interval) {
    super();
    this.db = db;
    this.interval = interval;
    this.intervalId = null;
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        // Execute command to get calibration record
        var r = yield self.db.command({serverStatus:true});
        // Create second based timetamp
        var timestamp = new Date();
        timestamp.setMilliseconds(0)

        // Emit the data
        self.emit('data', {
          name: 'server', topology: 'single', server: r.host,
          timestamp: timestamp, result: r
        });

        // Start up the interval checking
        self.intervalId = setInterval(function() {
          co(function*() {
            if(self.db == null) return;
            // Execute command
            var r = yield self.db.command({serverStatus:true});
            // Create second based timetamp
            var timestamp = new Date();
            timestamp.setMilliseconds(0)
            // Emit the data
            self.emit('data', {
              name: 'server', topology: 'single', server: r.host,
              timestamp: timestamp, result: r
            });
          }).catch(function(err) { reject(err); });
        }, self.interval);

        // Resolve the promise
        resolve();
      });
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        console.log(f('[MONITOR-SERVER MONITOR] - stopping topology monitor'));
        clearInterval(self.intervalId);
        if(self.db) self.db.close();
        console.log(f('[MONITOR-SERVER MONITOR] - stopped topology monitor'));
        resolve();
      }).catch(reject);
    });
  }
}

//   /*
//    * Monitor a single server
//    */
//   monitorServer() {
//     var self = this;
//
//     return new Promise(function(resolve, reject) {
//       co(function*() {
//         // Execute command to get calibration record
//         var r = yield self.db.command({serverStatus:true});
//         // Create second based timetamp
//         var timestamp = new Date();
//         timestamp.setMilliseconds(0)
//
//         // Emit the data
//         self.emit('data', {
//           name: 'server', topology: 'single', server: r.host,
//           timestamp: timestamp, result: r
//         });
//
//         // Start up the interval checking
//         self.intervalId = setInterval(function() {
//           co(function*() {
//             // Execute command
//             var r = yield self.db.command({serverStatus:true});
//             // Create second based timetamp
//             var timestamp = new Date();
//             timestamp.setMilliseconds(0)
//             // Emit the data
//             self.emit('data', {
//               name: 'server', topology: 'single', server: r.host,
//               timestamp: timestamp, result: r
//             });
//           }).catch(function(err) { reject(err); });
//         }, self.interval);
//
//         // Resolve the promise
//         resolve();
//       }).catch(function(err) { reject(err); });
//     });
//   }
//
//   /*
//    * Monitor a replicaset server set
//    */
//   monitorReplicaSet() {
//     var self = this;
//     // All active connections
//     var servers = [];
//     var errors = [];
//
//     return new Promise(function(resolve, reject) {
//       co(function*() {
//         // Monitor all the servers
//         var monitorServers = function(servers, ismaster) {
//           // Start up the interval checking
//           self.interval = setInterval(function() {
//             co(function*() {
//               // Iterate over all the servers
//               for(var i = 0; i < servers.length; i++) {
//                 yield executeOnServers(self, ismaster.setName, servers[i]);
//               }
//             });
//           }, self.interval);
//         }
//
//         // Get the candidate servers
//         var ismaster = yield locateMonitoringServers(db, servers, errors);
//         // Go through all the servers
//         monitorServers(servers, ismaster);
//         resolve();
//       }).catch(function(err) { reject(err); });
//     });
//   }
//
//   /*
//    * Monitor a sharded system
//    */
//   monitorShard() {
//     return new Promise(function(resolve, reject) {
//       co(function*() {
//         // Execute command to get calibration record
//         var r = yield db.command({serverStatus:true});
//         // Create second based timetamp
//         var timestamp = new Date();
//         timestamp.setMilliseconds(0)
//
//         // Get the actual shard configurations
//         var shards = yield db.db('config').collection('shards').find({}).toArray();
//
//         // Shard connections
//         var shardConnections = [];
//         var left = shards.length;
//         var errors = [];
//
//         // Connect to the shard
//         var connectToShard = function(shard) {
//           return new Promise(function(resolve, reject) {
//             co(function*() {
//               var shard = shards[i];
//               var hosts = shard.host.split('/')[1];
//
//               // Shard info
//               var shardInfo = {_id: shard._id, servers: []};
//
//               // Attempt to connect to all of the shards directly
//               var _db = yield MongoClient.connect(f('mongodb://%s/%s', hosts, db.databaseName));
//
//               // Locate all the servers
//               yield locateMonitoringServers(_db, shardInfo.servers, errors);
//               resolve(shardInfo);
//             });
//           }).catch(function(err) { reject(err); });
//         };
//
//         // Create connections for each shard
//         for(var i = 0; i < shards.length; i++) {
//           // Connect to the shard
//           var shardInfo = yield connectToShard(shards[i]);
//           shardConnections.push(shardInfo);
//
//           // Start up the interval checking
//           self.interval = setInterval(function() {
//             co(function*() {
//               // Execute command against mongos
//               var r = yield db.command({serverStatus:true});
//               // Create second based timetamp
//               var timestamp = new Date();
//               timestamp.setMilliseconds(0)
//               // Emit the data
//               self.emit('data', {
//                   name: 'mongos'
//                 , server: r.host
//                 , topology: 'mongos'
//                 , timestamp: timestamp
//                 , result: r
//               });
//
//               // Collect the data on the shard
//               var executeShard = function(shardInfo) {
//                 return new Promise(function(resolve, reject) {
//                   co(function*() {
//                     var servers = shardInfo.servers;
//                     var _id = shardInfo._id;
//
//                     // Iterate over all the servers
//                     for(var i = 0; i < servers.length; i++) {
//                       yield executeOnServers(self, _id, servers[i]);
//                     }
//
//                     resolve();
//                   }).catch(function(err) { reject(err); });
//                 });
//               }
//
//               // For each of the shards execute the gathering of the data
//               for(var i = 0; i < shardConnections.length; i++) {
//                 yield executeShard(shardConnections[i]);
//               }
//             });
//           }, self.interval);
//         }
//
//         resolve();
//       }).catch(function(err) { reject(err); });
//     });
//   }
// }
//
// //
// // Get the statistics for a server
// var executeOnServers = function(self, name, server) {
//   return new Promise(function(resolve, reject) {
//     co(function*() {
//       var r = yield server.command({serverStatus:true});
//       // Create second based timetamp
//       var timestamp = new Date();
//       timestamp.setMilliseconds(0)
//       // Emit the data
//       self.emit('data', {
//           name: name
//         , topology: 'replicaset'
//         , server: r.host
//         , timestamp: timestamp
//         , result: r
//       });
//     }).catch(function(err) { reject(err); });
//   });
// }
//
// //
// // Locate all candidate servers for monitoring in set
// var locateMonitoringServers = function(db, servers, errors) {
//   return new Promise(function(resolve, reject) {
//     co(function*() {
//       // Execute command to get calibration record
//       var r = yield db.command({ismaster:true});
//       // Get all the hosts and create a connection for each
//       for(var i = 0; i < r.hosts.length; i++) {
//         // Get the parts
//         var parts = r.hosts[i].split(/:/);
//         parts[1] = parseInt(parts[1], 10);
//
//         // Create a new db instance for this server
//         var d = new Db(db.databaseName, new Server(parts[0], parts[1]));
//         var d1 = yield db.open();
//
//         // Run ismaster
//         var r = yield d1.command({ismaster: true});
//         // Server we need to monitor
//         if(r.ismaster || r.secondary) servers.push(d1);
//       }
//
//       resolve(r);
//     }).catch(function(err) { reject(err); });
//   });
// }

module.exports = ServerMonitor;

"use strict";

var co = require('co'),
  cp = require('child_process'),
  f = require('util').format;

/*
 * Handles all the local agents
 */
class LocalAgents {
  constructor(options) {
    options = options || {};
    // Number of agents to boot up
    this.number = options.number || 2;
    // MongoDB url
    this.url = options.url || 'mongodb://localhost:27017/load?maxPoolSize=50';
    // Monitor Port
    this.monitorPort = options.port || 51000;
    // Host and port of the agents
    this.agentStartPort = options.agentStartPort || 52000;
    // Processes
    this.processes = [];
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var startPort = self.agentStartPort;

        for(var i = 0; i < self.number; i++) {
          var process = new Process({
            host: 'localhost',
            port: startPort++,
            url: self.url,
            monitorHost: 'localhost',
            monitorPort: self.monitorPort
          });
          // Add process to list
          self.processes.push(process);
          // Start the process
          yield process.start();
        }

        resolve();
      }).catch(reject);
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        for(var i = 0; i < self.processes.length; i++) {
          yield self.processes[i].stop();
        }

        resolve();
      }).catch(reject);
    });
  }
}

/*
 * Wraps the process of an agent
 */
class Process {
  constructor(options) {
    options = options || {};
    this.host = options.host || 'localhost';
    this.port = options.port || 52000;
    this.url = options.url || 'mongodb://localhost:27017/load?maxPoolSize=50';
    this.monitorHost = options.monitorHost || 'localhost';
    this.monitorPort = options.monitorPort || 51000;
    this.process = null;
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        ['-h', 'localhost', '-p', self.port];

        // For
        self.state = 'fork';
        // For the child
        self.process = cp.fork(__dirname + '/agent.js', [
            '--host', 'localhost'
          , '--port', self.port
          , '--url', self.url
          , '--monitorHost', self.monitorHost
          , '--monitorPort', self.monitorPort
        ]);

        // Receive message exit
        self.process.on('exit', function(code, signal) {
          console.log(f('[MONITOR] - process at %s:%s exited with code %s and signal %s', self.host, self.port, code, signal));
          self.state = 'exited';
        });

        // Receive message exit
        self.process.on('close', function(code, signal) {});

        // Receive error message
        self.process.on('error', function(err) {
          self.state = 'error';
          reject(err);
        });

        resolve();
      }).catch(reject);
    });
  }

  stop() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        console.log(f('[MONITOR] - killing process at %s:%s', self.host, self.port));

        self.process.kill();
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = LocalAgents;

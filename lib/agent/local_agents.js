"use strict";

var co = require('co'),
  Logger = require('../logger'),
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
    // Set the logger
    this.logger = new Logger('LocalAgents');
  }

  start() {
    var self = this;

    return new Promise(function(resolve, reject) {
      co(function*() {
        var startPort = self.agentStartPort;

        for(var i = 0; i < self.number; i++) {
          if(self.logger.isInfo()) self.logger.info(f('starting local agent on port %s', startPort));
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
          if(self.logger.isInfo()) self.logger.info(f('started local agent successfully on port %s', startPort));
        }

        resolve();
      }).catch(function(err) {
        self.logger.error(err);
        reject(err);
      });
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
    // Set the logger
    this.logger = new Logger('Process');
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
        if(self.logger.isInfo()) self.logger.info(f('stopping monitor server'));
          if(self.logger.isInfo()) self.logger.info(f('process at %s:%s exited with code %s and signal %s', self.host, self.port, code, signal));
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
        if(self.logger.isInfo()) self.logger.info(f('killing process at %s:%s', self.host, self.port));
        self.process.kill();
        resolve();
      }).catch(reject);
    });
  }
}

module.exports = LocalAgents;

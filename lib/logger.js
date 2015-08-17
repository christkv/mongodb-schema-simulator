"use strict"

var f = require('util').format;

var logLevel = 'info';
var logger = function(level, date, className, message) {
  console.log(f('[%s-%s] - [%s] - %s', level, date, className, message));
}

class Logger {
  constructor(className) {
    this.className = className;
  }

  info(message) {
    if(logLevel == 'info') {
      logger('INFO', new Date(), this.className, message);
    }
  }

  error(message) {
    if(logLevel == 'error') {
      logger('ERROR', new Date(), this.className, message);
    }
  }

  debug(message) {
    if(logLevel == 'debug') {
      logger('DEBUG', new Date(), this.className, message);
    }
  }

  isDebug() {
    return logLevel == 'debug';
  }

  isInfo() {
    return logLevel == 'info';
  }

  isError() {
    return logLevel == 'error';
  }

  static setLogger(output) {
    logger = output;
  }

  static setLevel(level) {
    logLevel = level;
  }
}

module.exports = Logger;
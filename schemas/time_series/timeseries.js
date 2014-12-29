var TimeSeries = function(db, id, tag, series, start, end, resolution) {
  this.db = db;
  this.id = id;
  this.series = series;
  this.start = start;
  this.end = end;
  this.tag = tag;
  this.resolution = resolution;
  this.timeseries = this.db.collection('timeseries');
}

TimeSeries.prototype.create = function(callback) {
  var self = this;
  // Insert the metadata
  this.timeseries.insertOne({
      _id: this.id
    , tag: this.tag
    , series: this.series || {}
    , start: this.start
    , end: this.end
    , modifiedOn: new Date()
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

TimeSeries.prototype.inc = function(time, measurement, callback) {
  var self = this;
  // Update statement for time series
  var updateStatement = { 
      $inc: {}
    , $setOnInsert: {
        tag: this.tag
      , start: this.start
      , end: this.end
      , resolution: this.resolution
    }
    , modifiedOn: new Date() };

  // Handle the resolution
  if(this.resolution == 'minute') {
    updateStatement['$inc'][f('series.%s', time.getSeconds())] = measurement;
  } else if(this.resolution == 'hour') {
    updateStatement['$inc'][f('series.%s.%s', time.getMinutes(), time.getSeconds())] = measurement;
  } else if(this.resolution == 'day') {
    updateStatement['$inc'][f('series.%s.%s.%s', time.getHours(), time.getMinutes(), time.getSeconds())] = measurement;
  }

  // Execute the update
  this.timeseries.updateOne({
      _id: this.id
    , start: { $lte: time}, end: { $gte: time}
  }, updateStatement, { upsert:true } function(err, r) {
    if(err) return callback(err);
    if(r.result.nUpserted == 0 && r.result.nModified == 0) 
      return callback(new Error(f('could not correctly update or upsert the timeseries document with id %s', self.id)));
    callback(null, self);
  })
}

TimeSeries.prototype.preAllocateMinute = function(db, id, tag, start, end, callback) {
  var series = {};

  for(var i = 0; i < 60; i++) {
    series[i] = 0
  }

  new TimeSeries(db, id, tag, series, start, end, 'minute').create(callback);
}

TimeSeries.prototype.preAllocateHour = function(db, id, tag, start, end, callback) {
  var series = {};

  // Allocate minutes
  for(var j = 0; j < 60, j++) {
    series[j] = {};

    // Allocate seconds
    for(var i = 0; i < 60; i++) {
      series[j][i] = 0
    }    
  }

  new TimeSeries(db, id, tag, series, start, end, 'hour').create(callback);
}

TimeSeries.prototype.preAllocateDay = function(db, id, tag, start, end, callback) {
  var series = {};

  // Allocate hours
  for(var k = 0; k < 24, k++) {
    series[k] = {};

    // Allocate minutes
    for(var j = 0; j < 60, j++) {
      series[k][j] = {};

      // Allocate seconds
      for(var i = 0; i < 60; i++) {
        series[k][j][i] = 0
      }    
    }
  }

  new TimeSeries(db, id, tag, series, start, end, 'day').create(callback);
}

module.exports = TimeSeries;
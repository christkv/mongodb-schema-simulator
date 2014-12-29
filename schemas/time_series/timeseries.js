var TimeSeries = function(db, id, series) {
  this.db = db;
  this.id = id;
  this.series = series;
  this.timeseries = this.db.collection('timeseries');
}

TimeSeries.prototype.create = function(callback) {
  var self = this;
  // Insert the metadata
  this.timeseries.insertOne({
      _id: this.id
    , series: this.series || {}
  }, function(err, r) {
    if(err) return callback(err);
    callback(null, self);
  });
}

module.exports = TimeSeries;
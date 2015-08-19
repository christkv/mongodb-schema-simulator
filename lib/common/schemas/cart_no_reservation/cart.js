"use strict";

var f = require('util').format,
  ObjectID = require('mongodb').ObjectID,
  Inventory = require('./inventory'),
  Order = require('./order'),
  co = require('co');

var clone = function(obj) {
  var o = {};
  for(var name in obj) o[name] = obj[name];
  return o;
}

class Cart {
  constructor(collections, id) {
    this.id = id == null ? new ObjectID() : id;
    this.products = [];
    this.collections = collections;
    this.carts = collections['carts'];
  }

  /*
   * Create a new cart instance and save it to mongodb
   */
  create(options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.carts.updateOne({
            _id: self.id,
          }, {
              _id: self.id
            , state: Cart.ACTIVE
            , modified_on: new Date()
            , products: []
          }, {upsert:true});
        if(r.result.writeConcernError) return reject(r.result.writeConcernError);
        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Add product to cart, no validation of availability is made
   * as this is determined at check out only
   */
  add(product, quantity, options) {
    var self = this;
    options = options || {};

    // Clone options
    options = clone(options);
    options.upsert = true;

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Add product to cart, and create cart with upsert
        // if it does not already exist
        var r = yield self.carts.updateOne({
          _id: self.id, state: Cart.ACTIVE
        }, {
            $set: { modified_on: new Date() }
          , $push: {
            products: {
                _id: product.id
              , quantity: quantity
              , name: product.name
              , price: product.price
            }
          }
        }, options);

        if(r.modifiedCount == 0) {
          return reject(new Error(f("failed to add product %s to the cart with id %s", product.id, self.id)))
        }

        if(r.result.writeConcernError) {
          return reject(r.result.writeConcernError);
        }

        self.products.push({
            _id: product.id
          , quantity: quantity
          , name: product.name
          , price: product.price
        });

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Remove product from cart
   */
  remove(product, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Remove the reservation from the cart itself
        var r = yield self.carts.updateOne({
            _id: self.id
          , "products._id": product.id
          , state: Cart.ACTIVE
        }, {
          $pull: { products: {_id: product.id }}
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to remove product %s from cart %s', product.id, self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Update the product quantity in the cart
   */
  update(product, quantity, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Update cart with the new quantity
        var r = yield self.carts.updateOne({
            _id: self.id
          , "products._id": product.id
          , state: Cart.ACTIVE
        }, {
          $set: {
              modified_on: new Date()
            , "products.$.quantity": quantity
          }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to set product quantity change of %s for cart %s', quantity, self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Attempt to checkout the products in the cart, late validation (like Amazon does)
   */
  checkout(details, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Fetch latest cart view
        var cart = yield self.carts.findOne({
          _id: self.id
        });

        if(!cart)
          return reject(new Error(f('could not located cart with id %s', self.id)));

        // Reserve the quantities for all the products (rolling back if some are not possible to cover)
        yield Inventory.reserve(self.collections, self.id, cart.products, options);

        // Create a new order instance
        var order = new Order(self.collections, new ObjectID()
          , details.shipping
          , details.payment
          , cart.products);

        // Create the document
        var order = yield order.create(options);

        // Set the state of the cart as completed
        var r = yield self.carts.updateOne({
            _id: self.id
          , state: Cart.ACTIVE
        }, {
          $set: { state: Cart.COMPLETED }
        }, options);

        if(r.modifiedCount == 0)
          return reject(new Error(f('failed to set cart %s to completed state', self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        // Commit the change to the inventory
        yield Inventory.commit(self.collections, self.id, options);
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Expired carts can just be set to canceled as there is no need to return inventory
   */
  releaseExpired(collections, options) {
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield collections['carts'].updateMany(
            {state: Cart.EXPIRED}
          , { $set: { state: Cart.CANCELED} }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections) {
    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['carts'].ensureIndex({state: 1});
        resolve();
      }).catch(function(err) {
        reject(err);
      });
    });
  }
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

module.exports = Cart;

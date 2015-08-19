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
    this.collections = collections;
    this.products = [];
    this.carts = collections['carts'];
  }

  /*
   * Create a new cart instance and save it to mongodb
   */
  create(options) {
    var self = this;
    options = options || {};
    options = clone(options);
    options.upsert = true;

    return new Promise(function(resolve, reject) {
      co(function* () {
        var r = yield self.carts.updateOne({
            _id: self.id,
          }, {
              state: Cart.ACTIVE
            , modified_on: new Date()
            , products: []
          }, options);

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Add product and quantity to cart if available in inventory
   */
  add(product, quantity, options) {
    var self = this;
    options = options || {};
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

        if(r.modifiedCount == 0)
          return reject(new Error(f("failed to add product %s to the cart with id %s", product.id, self.id)))

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        // Next update the inventory, if there is enough
        // quantity available, push the cart information to the
        // list of reservations product quantities
        var inventory = new Inventory(self.collections, product.id);

        try {
          yield inventory.reserve(self.id, quantity, options);
        } catch(err) {
          yield rollback(self, product, quantity);
          return reject(err);
        }

        self.products.push({
            _id: product.id
          , quantity: quantity
          , name: product.name
          , price: product.price
        });

        // return
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Remove product from cart and return quantity to inventory
   */
  remove(product, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var inventory = new Inventory(self.collections, product.id);
        // Remove from inventory reservation
        yield inventory.release(self.id, options);

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
      }).catch(reject);
    });
  }

  /*
   * Update the quantity of a product in the cart
   */
  update(product, quantity, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        // Get the latest cart view
        var doc = yield self.carts.findOne({_id: self.id})
        if(!doc)
          return reject(new Error(f('could not locate cart with id %s', self.id)));

        // Old quantity for the product
        var oldQuantity = 0;
        // Locate the product we wish to update
        for(var i = 0; i < doc.products.length; i++) {
          if(doc.products[i]._id == product.id) {
            oldQuantity = doc.products[i].quantity;
          }
        }

        // Calculate the delta
        var delta = quantity - oldQuantity;

        // Update the quantity in the cart
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
          return reject(new Error(f('could not locate the cart with id %s or product not found in cart', self.id)));

        if(r.result.writeConcernError)
          return reject(r.result.writeConcernError);

        try {
          var inventory = new Inventory(self.collections, product.id);
          // Attempt to reserve the quantity from the product inventory
          yield inventory.adjust(self.id, quantity, delta, options);
          return resolve(true)
        } catch(err) {
          // Rollback as we could not apply the adjustment in the reservation
          var r = yield self.carts.updateOne({
              _id: self.id
            , "products._id": product.id
            , state: Cart.ACTIVE
          }, {
            $set: {
                modified_on: new Date()
              , "products.$.quantity": oldQuantity
            }
          }, options);

          if(r.modifiedCount == 0)
            return reject(new Error(f('failed to rollback product quantity change of %s for cart %s', delta, self.id)));

          if(r.result.writeConcernError)
            return reject(r.result.writeConcernError);

          // Return original error message from the inventory reservation attempt
          reject(err);
        }
      }).catch(reject);
    });
  }

  /*
   * Perform the checkout of the products in the cart
   */
  checkout(details, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var cart = yield self.carts.findOne({_id: self.id});
        if(!cart)
          return reject(new Error(f('could not locate cart with id %s', self.id)));

        // Create a new order instance
        var order = new Order(self.collections, new ObjectID()
          , details.shipping
          , details.payment
          , cart.products);
        // Create the document
        yield order.create(options);

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
        resolve(self);
      }).catch(reject);
    });
  }

  /*
   * Release any of the expired carts
   */
  static releaseExpired(collections, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        var carts = yield collections['carts'].find({state: Cart.EXPIRED}).toArray();
        if(carts.length == 0)
          return resolve();

        // Process each cart
        var processCart = function(cart) {
          return new Promise(function(resolve, reject) {
            co(function* () {
              // Release all reservations for this cart
              yield Inventory.releaseAll(collections, cart._id, options);
              // Set cart to expired
              yield collections['carts'].updateOne(
                  { _id: cart._id }
                , { $set: { state: Cart.CANCELED }}, options);
              resolve();
            }).catch(reject);
          });
        }

        // Release all the carts
        for(var i = 0; i < carts.length; i++) {
          yield processCart(carts[i]);
        }

        resolve();
      }).catch(reject);
    });
  }

  /*
   * Create the optimal indexes for the queries
   */
  static createOptimalIndexes(collections, options) {
    var self = this;
    options = options || {};

    return new Promise(function(resolve, reject) {
      co(function* () {
        yield collections['carts'].ensureIndex({state: 1});
        resolve();
      }).catch(reject);
    });
  }
}

Cart.ACTIVE = 'active';
Cart.EXPIRED = 'expired';
Cart.COMPLETED = 'completed';
Cart.CANCELED = 'canceled';

var rollback = function(cart, product, quantity, options) {
  options = options || {};

  return new Promise(function(resolve, reject) {
    co(function* () {
      var r = yield cart.carts.updateOne({
        _id: cart.id, state: Cart.ACTIVE, 'products._id': product.id
      }, {
        $pull: { products: { _id: product.id } }
      }, options);

      if(r.result.writeConcernError)
        return reject(r.result.writeConcernError);

      reject(new Error(f("failed to reserve the quantity %s of product %s for cart %s", quantity, product.id, cart.id)))
    }).catch(reject);
  });
}

module.exports = Cart;

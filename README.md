# MongoDB Schema Simulator Tool

The MongoDB Schema Simulator Tool was built to allow simulating the schemas outlined in the `The Little MongoDB Schema Design Book`.

| Links |
|:-----------|
|[Simulation examples](https://github.com/christkv/mongodb-schema-simulator/tree/master/examples) |

## Installing the tool

Installing the tool is as simple as

```
npm install -g mongodb-schema-simulator
```

It installs two executables

```
schema-monitor
schema-agent
```

`schema-agent` is a load generating agent that applies traffic to your `MongoDB topology`.

`schema-monitor` is the monitor that orchestrates all the `agents` and generates the end reports.

**To see the options available for schema-agent and schema-monitor run the commands with the command line option -h**

The goal of this tool is to allow you to simulate the interaction of multiple different scenarios when applying load. We are going to use an ecommerce website as the example for the tool.

## Ecommerce website

We are going to simulate an ecommerce website schema. We've decided that we wish to look at two particular aspects.

1. Users browsing the product catalog
2. Users successfully adding 5 products to their cart and checking it out.

The tool comes with several built in scenarios (will be extended in the future.) You can list all the available scenarios by entering the command.

```
schema-monitor --scenarios
```

This will output a table containing the name and description of each scenario supported by the tool. Let's view the details of a particular scenario.

```
schema-monitor --scenarios cart_reservation_successful
```

This will output the `json` description of the scenario. In this case it might look something like the following.

```json
{
  "name": "cart_reservation_successful",
  "title": "fixed number of cart items with reservation",
  "description": "simulates successful carts with a fixed number of items in the cart with reservation",
  "params": {
    "numberOfItems": {
      "name": "number of items in the cart",
      "type": "number",
      "default": 5
    },
    "numberOfProducts": {
      "name": "number of products available",
      "type": "number",
      "default": 100
    },
    "sizeOfProductsInBytes": {
      "name": "size of products in bytes",
      "type": "number",
      "default": 1024
    }
  }
}
```

The `scenario` contains a name, title, description and a set of parameters that can be adjusted for the particular scenario to tune the behavior. In this case we can tune the `numberOfItems` in a cart, the `numberOfProducts` available and the `sizeOfProductsInBytes` for each product in the catalog.

We also wanted to use catalog browsing scenario. So let's list the one that shows all the products for a specific category.

```
schema-monitor --scenarios retrieve_products_by_category
```

The output is the following.

```
{
  "name": "retrieve_products_by_category",
  "title": "retrieve all the products for a specific category",
  "description": "retrieve all the products for a specific category",
  "params": {
    "numberOfProducts": {
      "name": "the number of preloaded products",
      "type": "number",
      "default": 1000
    },
    "treeStructure": {
      "name": "the tree structure layout",
      "type": "object",
      "default": [
        {
          "level": 0,
          "width": 5
        },
        {
          "level": 1,
          "width": 5
        },
        {
          "level": 2,
          "width": 5
        },
        {
          "level": 3,
          "width": 5
        },
        {
          "level": 4,
          "width": 5
        }
      ]
    }
  }
}
```

The types here are the `numberOfProducts` in our catalog and `treeStructure` the number of layers in out category tree and how many nodes are in each level. Note that this schema does not reuse the products from the `cart_reservation_successful` and is independent.

Let's put these two schemas together into a complete simulation that we wish to run against a single `MongoDB` instance. First create a new file which we will call `ecommerce_simulation.js`. Open the file and enter the following.

```js
var carts = {
  name: 'cart_reservation_successful',

  collections: { 
      carts: 'carts', products: 'products'
    , inventories: 'inventories', order: 'orders'
  },  

  params: {
      numberOfItems: 5, numberOfProducts: 1000
    , sizeOfProductsInBytes: 1024
  },

  db: 'shop',

  writeConcern: {
    metadata: { w: 1, wtimeout: 10000 }
  },

  setup: function(db, callback) {
    db.dropDatabase(function(err) {
      return callback();      
    });
  },

  execution: {
    iterations: 100, numberOfUsers: 50
  }
}

var browse = {
  name: 'retrieve_products_by_category',
  
  collections: { 
    categories: 'categories', products: 'cateogory_products'
  },

  params: {
      numberOfProducts: 10000
    , treeStructure: [{ level: 0, width: 5}
      , { level: 1, width: 5 }, { level: 2, width: 5}
      , { level: 3, width: 5 }, { level: 4, width: 5
    }]
  },

  db: 'shop',

  // readPreference settings
  readPreferences: {
      categories: { mode: 'secondaryPreferred' , tags: {} }
    , products: { mode: 'secondaryPreferred' , tags: {} }
  },  
  
  setup: function(db, callback) {
    db.dropDatabase(function(err) {
      return callback();      
    });
  },

  execution: {
    iterations: 100, numberOfUsers: 150
  }
}

module.exports = [carts, browse];
```

Each simulation is composed of one or more of the built in scenarios in the tool. Each scenario defines the following fields.

* `name`: The name of the scenario we wish to execute.
* `collections`: The collections we wish to run the scenario operations against.
* `params`: Paramters to execute the scenario against.
* `db`: The database to run the scenario against.
* `setup`: A setup function that is run `once` for the scenario allowing us to do setup operations like dropping the database, creating shard keys etc.
* `execution`: The execution parameters for the simulation tool relative to this scenario.

## Running a simulation

Let's run the `ecommerce_simulation.js` file through it's pases against a single `MongoDB` instance. First start up a mongodb instance.

```
mongod
```

Next let's execute the `simulation`.

```
schema-monitor -s ./ecommerce_simulation.js
```

The simulation will now start up and after it's finished you can find the resulting report in the `./out/index.html` file that is the default output of the tool.

In this case we ran the tool using locally spawned agent processes and `schema-monitor` managed the lifecycle of the load generation. You might find that you need to run agents on different machines to create enough load for you particular tests. 

## Running remote agents

We are going to run the same simulation as before but this time we are going to boot up two separate agents and have the monitor control them.

First let's boot the monitor in `remote` agent mode.

```
schema-monitor -s ./ecommerce_simulation.js -r
```

The process will start and await the number of agents needed to execute the scenario (the default is 2 processes, this can be controlled using the `-n` flag).

Open up to new terminals and in the first enter the following.

```
schema-agent -p 5024 -s localhost -m 5100
```

And in the next terminal enter the following

```
schema-agent -p 5025 -s localhost -m 5100
```

Notice that the running of the scenario will now kick off just as when we ran with the local agents.

## Optimize for latency

The Schema simulation tool lets you optimize against latency. F.ex you might want to know how many simultaneous users you can handle while keeping the scenario completion close to a specific amount of latency. In other words how many simultaneous users can we support while keeping the time it takes to complete a cart checkout around 100 in the 99 percentile.

Let's run the scenario above and optimize it.

```
schema-monitor -s ./ecommerce_simulation.js --optimize --optimize-mode latency --optimize-percentile 99 --optimize-latency-target 100 --optimize-for-scenario cart_reservation_successful --optimize-margin 25
```

What do the following options mean.

| Parameter | Description |
|:-----------|:------------|
| --optimize | Run an optimization against the provided scenario |
| --optimize-mode | Mode of optimization (total run time or latency) |
| --optimize-percentile | Optimize against the X percentile of the results |
| --optimize-latency-target | Latency target in milliseconds |
| --optimize-for-scenario | If multiple scenarios in a simulation pick the one to optimize for, otherwise it will pick the first available |
| --optimize-margin | The percentage margin of error +- that is acceptable for the optimization against the latency target, hitting the latency 100% is impossible so you need to ensure that you have a margin that allows the optimization to find a stable state and finish |

Once the optimization is done it will spit out a json file with the optimized parameters in the `--out` directory.








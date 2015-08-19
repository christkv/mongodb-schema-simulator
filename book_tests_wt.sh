# EXTRA_OPTIONS=-g
# EXTRA_OPTIONS=--url=mongodb://192.168.0.18/benchmark?maxPoolSize=50
# NODE_OPTIONS=--harmony --harmony_arrow_functions
NODE_OPTIONS=

####################################################################################
# Queries WiredTiger
####################################################################################
mkdir -p out/queue/wt
mkdir -p out/capped_queue/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/simulations/queue_fifo_simulation.js -o ./out/queue/wt/ -n 2 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/simulations/queue_fifo_capped_simulation.js -o ./out/capped_queue/wt/ -n 2 $EXTRA_OPTIONS

# ####################################################################################
# Topics WiredTiger
####################################################################################
mkdir -p out/topics/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/simulations/topic_simulation.js -o ./out/topics/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Metadata WiredTiger
####################################################################################
mkdir -p out/metadata/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/metadata/metadata_access_scenario.js -o ./out/metadata/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Category Hierarchy WiredTiger
####################################################################################
mkdir -p out/categoryhierarchy_direct/wt
mkdir -p out/categoryhierarchy_subtree/wt
mkdir -p out/categoryhierarchy_direct_ci/wt
mkdir -p out/categoryhierarchy_subtree_ci/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_scenario.js -o ./out/categoryhierarchy_direct/wt/ -n 4 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_category_scenario.js -o ./out/categoryhierarchy_subtree/wt/ -n 4 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_ci_scenario.js -o ./out/categoryhierarchy_direct_ci/wt/ -n 4 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_cat_ci_scenario.js -o ./out/categoryhierarchy_subtree_ci/wt/ -n 4 $EXTRA_OPTIONS


####################################################################################
# Cart No Reservation WiredTiger
####################################################################################
mkdir -p out/cart_no_reservation/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/cart_no_reservation/cart_5_item_no_reservation_successful_scenario.js -o ./out/cart_no_reservation/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Cart Reservation WiredTiger
####################################################################################
mkdir -p out/cart_no_reservation/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/cart_reservation/cart_5_item_reservation_successful_scenario.js -o ./out/cart_reservation/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Theater WiredTiger
####################################################################################
mkdir -p out/theater/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/theater/theater_reserve_tickets_successfully.js -o ./out/theater/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Timeseries WiredTiger
####################################################################################
mkdir -p out/timeseries/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/timeseries/exercise_time_series.js -o ./out/timeseries/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Multilanguage WiredTiger
####################################################################################
mkdir -p out/multilanguage_add_local/wt
mkdir -p out/multilanguage_remove_local/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_add_new_local_scenario.js -o ./out/multilanguage_add_local/wt/ -n 4 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_remove_local_scenario.js -o ./out/multilanguage_remove_local/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Array Cache WiredTiger
####################################################################################
mkdir -p out/array_slice_pre_allocated/wt
mkdir -p out/array_slice/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/array_slice/pre_allocated_cache_slice_scenario.js -o ./out/array_slice_pre_allocated/wt/ -n 4 $EXTRA_OPTIONS
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/array_slice/cache_slice_scenario.js -o ./out/array_slice/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Transactions WiredTiger
####################################################################################
mkdir -p out/transactions/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/account/account_100_successful_transfer_scenario.js -o ./out/transactions/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Write only workload
####################################################################################
mkdir -p out/writeonly/wt

# Execute the commands
killall iojs;node $NODE_OPTIONS ./monitor -s examples/scripts/single_or_replset/workloads/insert_scenario.js -o ./out/writeonly/wt/ -n 8 $EXTRA_OPTIONS

####################################################################################
# Generate all the reports
####################################################################################
node $NODE_OPTIONS report.js --db-path ./out/array_slice/wt/db --output-path=./out --report-file=./out/array_slice/wt/report.json --report-output-filename=array_slice_wt.html
node $NODE_OPTIONS report.js --db-path ./out/array_slice_pre_allocated/wt/db --output-path=./out --report-file=./out/array_slice_pre_allocated/wt/report.json --report-output-filename=array_slice_pre_allocated_wt.html
node $NODE_OPTIONS report.js --db-path ./out/capped_queue/wt/db --output-path=./out --report-file=./out/capped_queue/wt/report.json --report-output-filename=capped_queue_wt.html
node $NODE_OPTIONS report.js --db-path ./out/cart_no_reservation/wt/db --output-path=./out --report-file=./out/cart_no_reservation/wt/report.json --report-output-filename=cart_no_reservation_wt.html
node $NODE_OPTIONS report.js --db-path ./out/cart_reservation/wt/db --output-path=./out --report-file=./out/cart_reservation/wt/report.json --report-output-filename=cart_reservation_wt.html
node $NODE_OPTIONS report.js --db-path ./out/categoryhierarchy_direct/wt/db --output-path=./out --report-file=./out/categoryhierarchy_direct/wt/report.json --report-output-filename=categoryhierarchy_direct_wt.html
node $NODE_OPTIONS report.js --db-path ./out/categoryhierarchy_subtree_ci/wt/db --output-path=./out --report-file=./out/categoryhierarchy_subtree_ci/wt/report.json --report-output-filename=categoryhierarchy_subtree_ci_wt.html
node $NODE_OPTIONS report.js --db-path ./out/categoryhierarchy_subtree/wt/db --output-path=./out --report-file=./out/categoryhierarchy_subtree/wt/report.json --report-output-filename=categoryhierarchy_subtree_wt.html
node $NODE_OPTIONS report.js --db-path ./out/categoryhierarchy_subtree_ci/wt/db --output-path=./out --report-file=./out/categoryhierarchy_subtree_ci/wt/report.json --report-output-filename=categoryhierarchy_subtree_ci_wt.html
node $NODE_OPTIONS report.js --db-path ./out/metadata/wt/db --output-path=./out --report-file=./out/metadata/wt/report.json --report-output-filename=metadata_wt.html
node $NODE_OPTIONS report.js --db-path ./out/multilanguage_add_local/wt/db --output-path=./out --report-file=./out/multilanguage_add_local/wt/report.json --report-output-filename=multilanguage_add_local_wt.html
node $NODE_OPTIONS report.js --db-path ./out/multilanguage_remove_local/wt/db --output-path=./out --report-file=./out/multilanguage_remove_local/wt/report.json --report-output-filename=multilanguage_remove_local_wt.html
node $NODE_OPTIONS report.js --db-path ./out/queue/wt/db --output-path=./out --report-file=./out/queue/wt/report.json --report-output-filename=queue_wt.html
node $NODE_OPTIONS report.js --db-path ./out/theater/wt/db --output-path=./out --report-file=./out/theater/wt/report.json --report-output-filename=theater_wt.html
node $NODE_OPTIONS report.js --db-path ./out/timeseries/wt/db --output-path=./out --report-file=./out/timeseries/wt/report.json --report-output-filename=timeseries_wt.html
node $NODE_OPTIONS report.js --db-path ./out/topics/wt/db --output-path=./out --report-file=./out/topics/wt/report.json --report-output-filename=topics_wt.html
node $NODE_OPTIONS report.js --db-path ./out/transactions/wt/db --output-path=./out --report-file=./out/transactions/wt/report.json --report-output-filename=transactions_wt.html
node $NODE_OPTIONS report.js --db-path ./out/writeonly/wt/db --output-path=./out --report-file=./out/writeonly/wt/report.json --report-output-filename=writeonly_wt.html

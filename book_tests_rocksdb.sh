#EXTRA_OPTIONS=-g
EXTRA_OPTIONS=--url=mongodb://192.168.0.18/benchmark?maxPoolSize=50

####################################################################################
# Queries MMAP
####################################################################################
mkdir -p out/queue/rocksdb
mkdir -p out/capped_queue/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/simulations/queue_fifo_simulation.js -o ./out/queue/rocksdb/ -n 2 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/simulations/queue_fifo_capped_simulation.js -o ./out/capped_queue/rocksdb/ -n 2 $EXTRA_OPTIONS

# ####################################################################################
# Topics MMAP
####################################################################################
mkdir -p out/topics/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/simulations/topic_simulation.js -o ./out/topics/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Metadata MMAP
####################################################################################
mkdir -p out/metadata/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/metadata/metadata_access_scenario.js -o ./out/metadata/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Category Hierarchy MMAP
####################################################################################
mkdir -p out/categoryhierarchy_direct/rocksdb
mkdir -p out/categoryhierarchy_subtree/rocksdb
mkdir -p out/categoryhierarchy_direct_ci/rocksdb
mkdir -p out/categoryhierarchy_subtree_ci/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_scenario.js -o ./out/categoryhierarchy_direct/rocksdb/ -n 4 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_category_scenario.js -o ./out/categoryhierarchy_subtree/rocksdb/ -n 4 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_ci_scenario.js -o ./out/categoryhierarchy_direct_ci/rocksdb/ -n 4 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_cat_ci_scenario.js -o ./out/categoryhierarchy_subtree_ci/rocksdb/ -n 4 $EXTRA_OPTIONS


####################################################################################
# Cart No Reservation MMAP
####################################################################################
mkdir -p out/cart_no_reservation/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/cart_no_reservation/cart_5_item_no_reservation_successful_scenario.js -o ./out/cart_no_reservation/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Cart Reservation MMAP
####################################################################################
mkdir -p out/cart_no_reservation/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/cart_reservation/cart_5_item_reservation_successful_scenario.js -o ./out/cart_reservation/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Theater MMAP
####################################################################################
mkdir -p out/theater/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/theater/theater_reserve_tickets_successfully.js -o ./out/theater/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Timeseries MMAP
####################################################################################
mkdir -p out/timeseries/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/timeseries/exercise_time_series.js -o ./out/timeseries/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Multilanguage MMAP
####################################################################################
mkdir -p out/multilanguage_add_local/rocksdb
mkdir -p out/multilanguage_remove_local/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_add_new_local_scenario.js -o ./out/multilanguage_add_local/rocksdb/ -n 4 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_remove_local_scenario.js -o ./out/multilanguage_remove_local/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Array Cache MMAP
####################################################################################
mkdir -p out/array_slice_pre_allocated/rocksdb
mkdir -p out/array_slice/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/array_slice/pre_allocated_cache_slice_scenario.js -o ./out/array_slice_pre_allocated/rocksdb/ -n 4 $EXTRA_OPTIONS
killall iojs;node ./monitor -s examples/scripts/single_or_replset/array_slice/cache_slice_scenario.js -o ./out/array_slice/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Transactions MMAP
####################################################################################
mkdir -p out/transactions/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/account/account_100_successful_transfer_scenario.js -o ./out/transactions/rocksdb/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Write only workload
####################################################################################
mkdir -p out/writeonly/rocksdb

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/workloads/insert_scenario.js -o ./out/writeonly/rocksdb/ -n 8 $EXTRA_OPTIONS


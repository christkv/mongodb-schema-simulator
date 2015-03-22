####################################################################################
# Queries MMAP
####################################################################################
mkdir -p out/queue/mmap
mkdir -p out/capped_queue/mmap

# Execute the commands
node ./monitor -s examples/simulations/queue_fifo_simulation.js -o ./out/queue/mmap/
node ./monitor -s examples/simulations/queue_fifo_capped_simulation.js -o ./out/capped_queue/mmap/

####################################################################################
# Topics MMAP
####################################################################################
mkdir -p out/topics/mmap

# Execute the commands
node ./monitor -s examples/simulations/topic_simulation.js -o ./out/queue/mmap/

####################################################################################
# Metadata MMAP
####################################################################################
mkdir -p out/metadata/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/metadata/metadata_access_scenario.js -o ./out/metadata/mmap/

####################################################################################
# Category Hierarchy MMAP
####################################################################################
mkdir -p out/categoryhierarchy_direct/mmap
mkdir -p out/categoryhierarchy_subtree/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_scenario.js -o ./out/categoryhierarchy_direct/mmap/
node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_category_scenario.js -o ./out/categoryhierarchy_subtree/mmap/

####################################################################################
# Cart No Reservation MMAP
####################################################################################
mkdir -p out/cart_no_reservation/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/cart_no_reservation/cart_5_item_no_reservation_successful_scenario.js -o ./out/cart_no_reservation/mmap/

####################################################################################
# Cart Reservation MMAP
####################################################################################
mkdir -p out/cart_no_reservation/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/cart_reservation/cart_5_item_reservation_successful_scenario.js -o ./out/cart_reservation/mmap/

####################################################################################
# Theater MMAP
####################################################################################
mkdir -p out/theater/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/theater/theater_reserve_tickets_successfully.js -o ./out/theater/mmap/

####################################################################################
# Timeseries MMAP
####################################################################################
mkdir -p out/timeseries/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/timeseries/exercise_time_series.js -o ./out/timeseries/mmap/

####################################################################################
# Multilanguage MMAP
####################################################################################
mkdir -p out/multilanguage_add_local/mmap
mkdir -p out/multilanguage_remove_local/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_add_new_local_scenario.js -o ./out/multilanguage_add_local/mmap/
node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_remove_local_scenario.js -o ./out/multilanguage_remove_local/mmap/

####################################################################################
# Array Cache MMAP
####################################################################################
mkdir -p out/array_slice_pre_allocated/mmap
mkdir -p out/array_slice/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/array_slice/pre_allocated_cache_slice_scenario.js -o ./out/array_slice_pre_allocated/mmap/
node ./monitor -s examples/scripts/single_or_replset/array_slice/cache_slice_scenario.js -o ./out/array_slice/mmap/

####################################################################################
# Transactions MMAP
####################################################################################
mkdir -p out/transactions/mmap

# Execute the commands
node ./monitor -s examples/scripts/single_or_replset/account/exercise_time_series.js -o ./out/transactions/mmap/











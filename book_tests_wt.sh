EXTRA_OPTIONS=-g
# EXTRA_OPTIONS=

# ####################################################################################
# # Queries MMAP
# ####################################################################################
# mkdir -p out/queue/wt
# mkdir -p out/capped_queue/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/simulations/queue_fifo_simulation.js -o ./out/queue/wt/ -n 4 $EXTRA_OPTIONS
# killall iojs;node ./monitor -s examples/simulations/queue_fifo_capped_simulation.js -o ./out/capped_queue/wt/ -n 4 $EXTRA_OPTIONS

# # ####################################################################################
# # Topics MMAP
# ####################################################################################
# mkdir -p out/topics/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/simulations/topic_simulation.js -o ./out/topics/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Metadata MMAP
# ####################################################################################
# mkdir -p out/metadata/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/metadata/metadata_access_scenario.js -o ./out/metadata/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Category Hierarchy MMAP
# ####################################################################################
# mkdir -p out/categoryhierarchy_direct/wt
# mkdir -p out/categoryhierarchy_subtree/wt
# mkdir -p out/categoryhierarchy_direct_ci/wt
# mkdir -p out/categoryhierarchy_subtree_ci/wt

# # # Execute the commands
# # killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_scenario.js -o ./out/categoryhierarchy_direct/wt/ -n 4 $EXTRA_OPTIONS
# # killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_category_scenario.js -o ./out/categoryhierarchy_subtree/wt/ -n 4 $EXTRA_OPTIONS
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_direct_child_categories_ci_scenario.js -o ./out/categoryhierarchy_direct_ci/wt/ -n 4 $EXTRA_OPTIONS
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/materialized_path_category_hierarchy/retrieve_entire_sub_tree_by_cat_ci_scenario.js -o ./out/categoryhierarchy_subtree_ci/wt/ -n 4 $EXTRA_OPTIONS


# ####################################################################################
# # Cart No Reservation MMAP
# ####################################################################################
# mkdir -p out/cart_no_reservation/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/cart_no_reservation/cart_5_item_no_reservation_successful_scenario.js -o ./out/cart_no_reservation/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Cart Reservation MMAP
# ####################################################################################
# mkdir -p out/cart_no_reservation/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/cart_reservation/cart_5_item_reservation_successful_scenario.js -o ./out/cart_reservation/wt/ -n 4 $EXTRA_OPTIONS

####################################################################################
# Theater MMAP
####################################################################################
mkdir -p out/theater/wt

# Execute the commands
killall iojs;node ./monitor -s examples/scripts/single_or_replset/theater/theater_reserve_tickets_successfully.js -o ./out/theater/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Timeseries MMAP
# ####################################################################################
# mkdir -p out/timeseries/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/timeseries/exercise_time_series.js -o ./out/timeseries/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Multilanguage MMAP
# ####################################################################################
# mkdir -p out/multilanguage_add_local/wt
# mkdir -p out/multilanguage_remove_local/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_add_new_local_scenario.js -o ./out/multilanguage_add_local/wt/ -n 4 $EXTRA_OPTIONS
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/multilanguage/multilanguage_remove_local_scenario.js -o ./out/multilanguage_remove_local/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Array Cache MMAP
# ####################################################################################
# mkdir -p out/array_slice_pre_allocated/wt
# mkdir -p out/array_slice/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/array_slice/pre_allocated_cache_slice_scenario.js -o ./out/array_slice_pre_allocated/wt/ -n 4 $EXTRA_OPTIONS
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/array_slice/cache_slice_scenario.js -o ./out/array_slice/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Transactions MMAP
# ####################################################################################
# mkdir -p out/transactions/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/account/account_100_successful_transfer_scenario.js -o ./out/transactions/wt/ -n 4 $EXTRA_OPTIONS

# ####################################################################################
# # Write only workload
# ####################################################################################
# mkdir -p out/writeonly/wt

# # Execute the commands
# killall iojs;node ./monitor -s examples/scripts/single_or_replset/workloads/insert_scenario.js -o ./out/writeonly/wt/ -n 8 $EXTRA_OPTIONS


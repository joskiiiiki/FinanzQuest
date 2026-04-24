#!/bin/sh
echo "Running updater at startup..."
/usr/local/bin/run_updater.sh
echo "Starting cron daemon..."
crond -f -l 2

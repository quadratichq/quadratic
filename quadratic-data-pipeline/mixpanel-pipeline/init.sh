#! /bin/bash

# This script is used to initialize the mixpanel pipeline.
# For Docker usage, run: docker-compose run meltano ./init.sh

# Add Mixpanel extractor
meltano add extractor tap-mixpanel

# Custom Parquet loader is already defined in meltano.yml
echo "Custom Parquet target configured in meltano.yml"

echo "Plugins added successfully!"
echo "Updating plugin locks..."
meltano lock --update --all
echo "Installing plugins..."
meltano install
echo "Setup completed successfully!"
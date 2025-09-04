#!/bin/bash

# Docker script to run the Mixpanel to S3 Parquet pipeline
set -e

echo "Starting Mixpanel data pipeline..."

# Install plugins if needed
echo "Installing Meltano plugins..."
meltano lock --update --all
meltano install

# Environment variables from .env file are automatically available to Meltano
echo "Using environment variables for plugin configuration..."

# Run Meltano pipeline with custom Parquet target
echo "Running Meltano extraction and load to Parquet files..."
meltano run tap-mixpanel target-parquet-custom

# Use DataFusion to merge new data with existing consolidated file from S3
echo "🔄 Processing incremental updates:"
echo "  1. Download existing consolidated file from S3 (if exists)"
echo "  2. Merge with new batch files using DataFusion"
echo "  3. Create updated consolidated file"
python3 ./incremental-update.py

# Upload both individual batch files and consolidated file to LocalStack S3
echo "Uploading Parquet files to LocalStack S3..."

# Create bucket if it doesn't exist
aws --endpoint-url=http://host.docker.internal:4566 s3 mb s3://mixpanel-data 2>/dev/null || true

# Upload consolidated file
if [ -f "/project/output/mixpanel_data.parquet" ]; then
    aws --endpoint-url=http://host.docker.internal:4566 s3 cp /project/output/mixpanel_data.parquet s3://mixpanel-data/consolidated/mixpanel_data.parquet
    echo "✅ Consolidated Parquet file uploaded to: s3://mixpanel-data/consolidated/mixpanel_data.parquet"
else
    echo "❌ No consolidated Parquet file found"
fi

# Upload individual batch files
if [ -d "/project/output/batches" ]; then
    aws --endpoint-url=http://host.docker.internal:4566 s3 sync /project/output/batches/ s3://mixpanel-data/batches/ --exclude "*" --include "*.parquet"
    
    batch_count=$(ls -1 /project/output/batches/*.parquet 2>/dev/null | wc -l)
    echo "✅ Uploaded $batch_count individual batch files to: s3://mixpanel-data/batches/"
else
    echo "❌ No batch files directory found"
fi

echo ""
echo "🎯 DataFusion Query Options:"
echo "  - Single file: s3://mixpanel-data/consolidated/mixpanel_data.parquet"
echo "  - Batch files: s3://mixpanel-data/batches/*.parquet"
echo ""

# Show all uploaded files
echo "📊 All files in S3:"
aws --endpoint-url=http://host.docker.internal:4566 s3 ls s3://mixpanel-data/ --recursive --human-readable

echo "Pipeline completed successfully!"

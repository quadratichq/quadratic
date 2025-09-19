#!/bin/bash

# Docker script to run the Mixpanel to S3 Parquet pipeline
set -e

# Function to calculate and display elapsed time
calculate_elapsed_time() {
    local start_time=$1
    local end_time=$2
    local elapsed=$((end_time - start_time))
    local hours=$((elapsed / 3600))
    local minutes=$(((elapsed % 3600) / 60))
    local seconds=$((elapsed % 60))
    
    if [ $hours -gt 0 ]; then
        echo "${hours}h ${minutes}m ${seconds}s"
    elif [ $minutes -gt 0 ]; then
        echo "${minutes}m ${seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Record pipeline start time
PIPELINE_START_TIME=$(date +%s)
echo "Starting Mixpanel data pipeline at $(date)..."

# Install plugins if needed
echo "Installing Meltano plugins..."
INSTALL_START_TIME=$(date +%s)
meltano lock --update --all
meltano install
INSTALL_END_TIME=$(date +%s)
echo "✅ Plugin installation completed in $(calculate_elapsed_time $INSTALL_START_TIME $INSTALL_END_TIME)"

echo "Making scripts executable..."
chmod +x *.sh *.py

# Environment variables from .env file are automatically available to Meltano
echo "Using environment variables for plugin configuration..."

# Run Meltano pipeline with custom Parquet target
echo "Running Meltano extraction and load to Parquet files..."
EXTRACTION_START_TIME=$(date +%s)

# Run meltano and capture exit code for graceful error handling
set +e  # Disable exit on error temporarily
meltano run tap-mixpanel target-parquet-custom 2>&1 | tee /tmp/meltano_output.log
MELTANO_EXIT_CODE=$?
set -e  # Re-enable exit on error

EXTRACTION_END_TIME=$(date +%s)

# Check if the error is the expected revenue endpoint error
if [ $MELTANO_EXIT_CODE -ne 0 ]; then
    echo "⚠️  Meltano exited with code $MELTANO_EXIT_CODE"
    
    # Check if parquet files were created (indicating successful data extraction)
    PARQUET_COUNT=$(find /project/output -name "*.parquet" -type f | wc -l)
    
    # Check if this is the expected revenue endpoint error
    REVENUE_ERROR=$(grep -c "Invalid endpoint: revenue" /tmp/meltano_output.log 2>/dev/null || echo "0")
    TARGET_SUCCESS=$(grep -c "Parquet target completed successfully" /tmp/meltano_output.log 2>/dev/null || echo "0")
    
    if [ $PARQUET_COUNT -gt 0 ] && [ $TARGET_SUCCESS -gt 0 ]; then
        echo "✅ Data extraction completed successfully ($PARQUET_COUNT parquet files created)"
        if [ $REVENUE_ERROR -gt 0 ]; then
            echo "   Exit code caused by expected revenue endpoint error (not available for this account)"
        else
            echo "   Exit code occurred after successful data extraction"
        fi
        echo "   This does not affect the core data extraction process"
    else
        echo "❌ Real extraction failure detected - no parquet files created or target did not complete"
        exit $MELTANO_EXIT_CODE
    fi
else
    echo "✅ Data extraction and load completed successfully"
fi

echo "✅ Data extraction phase completed in $(calculate_elapsed_time $EXTRACTION_START_TIME $EXTRACTION_END_TIME)"

# Use PyArrow to merge new data with existing consolidated file from S3
echo "🔄 Processing incremental updates:"
echo "  1. Download existing consolidated file from S3 (if exists)"
echo "  2. Merge with new batch files using DataFusion"
echo "  3. Create updated consolidated file"
PROCESSING_START_TIME=$(date +%s)
python3 ./incremental-update.py
PROCESSING_END_TIME=$(date +%s)
echo "✅ Incremental update processing completed in $(calculate_elapsed_time $PROCESSING_START_TIME $PROCESSING_END_TIME)"

# Upload both individual batch files and consolidated file to S3
echo "Uploading Parquet files to S3..."
UPLOAD_START_TIME=$(date +%s)

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
echo "🎯 Parquet files located at:"
echo "  - Single file: s3://mixpanel-data/consolidated/mixpanel_data.parquet"
echo "  - Batch files: s3://mixpanel-data/batches/*.parquet"
echo ""

# Show all uploaded files
echo "📊 All files in S3:"
aws --endpoint-url=http://host.docker.internal:4566 s3 ls s3://mixpanel-data/ --recursive --human-readable

UPLOAD_END_TIME=$(date +%s)
echo "✅ S3 upload completed in $(calculate_elapsed_time $UPLOAD_START_TIME $UPLOAD_END_TIME)"

# Calculate and display total pipeline time
PIPELINE_END_TIME=$(date +%s)
TOTAL_TIME=$(calculate_elapsed_time $PIPELINE_START_TIME $PIPELINE_END_TIME)

echo ""
echo "🎯 Pipeline Timing Summary:"
echo "  📦 Plugin Installation: $(calculate_elapsed_time $INSTALL_START_TIME $INSTALL_END_TIME)"
echo "  📊 Data Extraction: $(calculate_elapsed_time $EXTRACTION_START_TIME $EXTRACTION_END_TIME)"
echo "  🔄 Data Processing: $(calculate_elapsed_time $PROCESSING_START_TIME $PROCESSING_END_TIME)"
echo "  ☁️  S3 Upload: $(calculate_elapsed_time $UPLOAD_START_TIME $UPLOAD_END_TIME)"
echo "  ⏱️  Total Pipeline Time: $TOTAL_TIME"
echo ""
echo "Pipeline completed successfully at $(date)!"

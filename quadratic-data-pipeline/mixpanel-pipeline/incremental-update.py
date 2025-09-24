#!/usr/bin/env python3
"""
Simple incremental update script for Mixpanel Parquet files.
This script combines all batch files into a single consolidated Parquet file.
"""

import os
import sys
import pandas as pd
import pyarrow.parquet as pq

def combine_parquet_files(output_dir: str, output_file: str):
    """
    Combine all batch Parquet files into a single consolidated file.
    Simple concatenation without complex deduplication.
    """
    try:
        print(f"Looking for batch files in: {output_dir}")
        all_files = os.listdir(output_dir)
        print(f"All files in directory: {len(all_files)}")
        
        # Find all parquet batch files
        parquet_files = [f for f in all_files 
                        if f.endswith('.parquet') and f.startswith('mixpanel_batch_')]
        
        print(f"Batch files found: {parquet_files[:5]}..." if len(parquet_files) > 5 else f"Batch files found: {parquet_files}")
        
        if not parquet_files:
            print("No batch Parquet files found")
            return False
        
        print(f"Found {len(parquet_files)} batch files to combine")
        
        # Read and combine all files
        dataframes = []
        for file in sorted(parquet_files):  # Sort to ensure consistent ordering
            file_path = os.path.join(output_dir, file)
            print(f"Reading {file}...")
            df = pd.read_parquet(file_path)
            dataframes.append(df)
        
        # Concatenate all dataframes
        print("Combining all data...")
        combined_df = pd.concat(dataframes, ignore_index=True)
        
        # Sort by timestamp if available
        if 'time' in combined_df.columns:
            combined_df = combined_df.sort_values('time')
        elif '_sdc_extracted_at' in combined_df.columns:
            combined_df = combined_df.sort_values('_sdc_extracted_at')
        
        # Write consolidated file
        combined_df.to_parquet(output_file, compression='snappy', index=False)
        
        print(f"Consolidated Parquet file written to: {output_file}")
        print(f"Total records: {len(combined_df)}")
        
        return True
        
    except Exception as e:
        print(f"Error during combination: {e}")
        return False

def download_existing_from_s3(s3_path: str, local_path: str) -> bool:
    """Download existing consolidated file from S3 if it exists"""
    try:
        cmd = f"aws --endpoint-url=http://host.docker.internal:4566 s3 cp {s3_path} {local_path}"
        result = os.system(cmd)
        if result == 0:
            print(f"✅ Downloaded existing consolidated file from S3: {s3_path}")
            return True
        else:
            print(f"📝 No existing consolidated file found in S3 (first run)")
            return False
    except Exception as e:
        print(f"❌ Error downloading from S3: {e}")
        return False

def main():
    """Main incremental update logic with S3 download/upload"""
    
    # Paths
    output_dir = "/project/output"
    final_file = f"{output_dir}/mixpanel_data.parquet"
    s3_consolidated_path = "s3://synced-data/consolidated/mixpanel_data.parquet"
    batch_dir = f"{output_dir}/batches"
    
    # Download existing consolidated file from S3 (optional, for incremental updates)
    print("🔄 Checking for existing consolidated file in S3...")
    download_existing_from_s3(s3_consolidated_path, f"{final_file}.existing")
    
    # Check for batch files in both locations
    parquet_files_in_output = [f for f in os.listdir(output_dir) 
                              if f.endswith('.parquet') and f.startswith('mixpanel_batch_')]
    
    if not parquet_files_in_output and os.path.exists(batch_dir):
        # Files might be in batches directory, move them back temporarily
        batch_files = [f for f in os.listdir(batch_dir) 
                      if f.endswith('.parquet') and f.startswith('mixpanel_batch_')]
        print(f"Found {len(batch_files)} files in batches directory, moving back to process...")
        for batch_file in batch_files:
            src = os.path.join(batch_dir, batch_file)
            dst = os.path.join(output_dir, batch_file)
            os.rename(src, dst)
        print(f"Moved {len(batch_files)} files back to output directory for processing")
    elif parquet_files_in_output:
        print(f"Found {len(parquet_files_in_output)} files in output directory")
    
    # Combine all batch files into a single consolidated file
    success = combine_parquet_files(output_dir, final_file)
    
    if success:
        # Keep the individual batch files for separate S3 upload
        # Move them to a 'batches' subdirectory for organization
        os.makedirs(batch_dir, exist_ok=True)
        
        parquet_files = [f for f in os.listdir(output_dir) 
                        if f.endswith('.parquet') and f.startswith('mixpanel_batch_')]
        
        for temp_file in parquet_files:
            temp_path = f"{output_dir}/{temp_file}"
            batch_path = f"{batch_dir}/{temp_file}"
            os.rename(temp_path, batch_path)
            print(f"Moved batch file to: batches/{temp_file}")
        
        print("Incremental update completed successfully!")
        print(f"Individual batch files preserved in: {batch_dir}")
        print(f"Consolidated file created: {final_file}")
        return True
    else:
        print("Incremental update failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

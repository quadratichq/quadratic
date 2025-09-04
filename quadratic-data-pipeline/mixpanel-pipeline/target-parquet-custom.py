#!/usr/bin/env python3
"""
Custom Meltano target that writes Singer messages directly to Parquet format.
This bypasses the dependency issues with existing Parquet targets.
"""

import sys
import json
import os
import pandas as pd
import pyarrow.parquet as pq
from typing import Dict, Any, List
from datetime import datetime

class ParquetTarget:
    def __init__(self):
        self.config = self._load_config()
        self.records: List[Dict[str, Any]] = []
        self.schemas: Dict[str, Dict] = {}
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment variables"""
        return {
            'destination_path': os.getenv('TARGET_PARQUET_DESTINATION_PATH', '/project/output/'),
            'compression': os.getenv('TARGET_PARQUET_COMPRESSION', 'snappy')
        }
    
    def process_line(self, line: str) -> None:
        """Process a single Singer message line"""
        try:
            message = json.loads(line)
            message_type = message.get('type')
            
            if message_type == 'SCHEMA':
                stream = message['stream']
                schema = message['schema']
                self.schemas[stream] = schema
                print(f"Received schema for stream: {stream}", file=sys.stderr)
                
            elif message_type == 'RECORD':
                stream = message['stream']
                record = message['record']
                
                # Add metadata
                record['_sdc_extracted_at'] = datetime.utcnow().isoformat()
                record['_stream'] = stream
                
                self.records.append(record)
                
                # Write in batches for memory efficiency
                if len(self.records) >= 1000:
                    self._write_batch()
                    
            elif message_type == 'STATE':
                # Handle state messages
                print(f"State: {message}", file=sys.stderr)
                
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}", file=sys.stderr)
        except Exception as e:
            print(f"Error processing message: {e}", file=sys.stderr)
    
    def _write_batch(self) -> None:
        """Write current batch of records to Parquet"""
        if not self.records:
            return
            
        try:
            # Convert to DataFrame
            df = pd.DataFrame(self.records)
            
            # Ensure output directory exists
            os.makedirs(self.config['destination_path'], exist_ok=True)
            
            # Write to Parquet
            output_file = os.path.join(
                self.config['destination_path'], 
                f"mixpanel_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.parquet"
            )
            
            df.to_parquet(
                output_file, 
                compression=self.config['compression'],
                index=False
            )
            
            print(f"Wrote {len(self.records)} records to {output_file}", file=sys.stderr)
            
            # Clear records
            self.records = []
            
        except Exception as e:
            print(f"Error writing Parquet batch: {e}", file=sys.stderr)
    
    def finalize(self) -> None:
        """Write any remaining records and finalize"""
        if self.records:
            self._write_batch()
        
        print("Parquet target completed successfully", file=sys.stderr)
    
    def run(self) -> None:
        """Main execution loop"""
        print("Starting custom Parquet target...", file=sys.stderr)
        
        try:
            for line in sys.stdin:
                if line.strip():
                    self.process_line(line.strip())
            
            self.finalize()
            
        except KeyboardInterrupt:
            print("Target interrupted", file=sys.stderr)
            self.finalize()
        except Exception as e:
            print(f"Fatal error: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    target = ParquetTarget()
    target.run()

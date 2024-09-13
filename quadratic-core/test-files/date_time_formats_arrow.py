import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd
from datetime import datetime

# Create data with consistent lengths
data = {
    "date": [
        datetime(2024, 12, 21).strftime("%Y-%m-%d"),
        datetime(2024, 12, 22).strftime("%Y-%m-%d"),
        datetime(2024, 12, 23).strftime("%Y-%m-%d"),
    ],
    "time": [
        datetime(2024, 12, 21, 13, 23, 0).strftime("%H:%M:%S"),
        datetime(2024, 12, 21, 14, 45, 0).strftime("%H:%M:%S"),
        datetime(2024, 12, 21, 16, 30, 0).strftime("%H:%M:%S"),
    ],
    "datetime": [
        datetime(2024, 12, 21, 13, 23).strftime("%Y-%m-%d %H:%M:%S"),
        datetime(2024, 12, 22, 14, 30).strftime("%Y-%m-%d %H:%M:%S"),
        datetime(2024, 12, 23, 16, 45).strftime("%Y-%m-%d %H:%M:%S"),
    ],
}

# Convert to DataFrame
df = pd.DataFrame(data)

# Convert DataFrame columns to PyArrow arrays with appropriate data types
date_array = pa.array(pd.to_datetime(df["date"]).dt.date)
time_array = pa.array(pd.to_datetime(df["time"], format="%H:%M:%S").dt.time)
datetime_array = pa.array(pd.to_datetime(df["datetime"]))

# Define PyArrow schema
schema = pa.schema(
    [
        ("date", pa.date32()),  # Date in YYYY-MM-DD format
        ("time", pa.time64("ns")),  # Time with nanoseconds precision
        ("datetime", pa.timestamp("ms")),  # Datetime with milliseconds precision
    ]
)

# Create PyArrow Table
table = pa.Table.from_arrays([date_array, time_array, datetime_array], schema=schema)

# Write Table to Parquet file
pq.write_table(table, "date_time_formats_arrow.parquet")

print("Parquet file 'test_date_time_formats_arrow.parquet' created successfully.")

import pandas as pd

# Helper function to convert cell values based on type
def convert_cell_value(value, type_u8):
    if type_u8 == 0:  # Blank
        return None
    elif type_u8 == 1:  # Text
        return value
    elif type_u8 == 2:  # Number
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value
    elif type_u8 == 3:  # Logical
        return value.lower() == 'true'
    else:  # Default to text
        return value

# Single cell case
if w == 1 and h == 1:
    cell_data = cells_data
    if cell_data:
        cell = cell_data[0]
        result = convert_cell_value(cell['v'], cell['t'])
    else:
        result = None
else:
    # Multiple cells - create DataFrame
    data = [[None] * w for _ in range(h)]
    
    cells_data = cells_data
    for cell in cells_data:
        row = cell['y'] - start_y
        col = cell['x'] - start_x
        if 0 <= row < h and 0 <= col < w:
            data[row][col] = convert_cell_value(cell['v'], cell['t'])
    
    df = pd.DataFrame(data)
    
    # Handle headers if needed
    if first_row_header or has_headers:
        if h > 0:
            headers = [str(val) for val in df.iloc[0]]
            df.columns = headers
            df = df.iloc[1:].reset_index(drop=True)
    
    result = df

result
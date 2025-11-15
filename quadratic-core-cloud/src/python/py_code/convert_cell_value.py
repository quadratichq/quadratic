import pandas as pd


# Helper function to parse duration strings (e.g., "5d 3600s 0µs")
def parse_duration(value: str):
    import re
    from dateutil.relativedelta import relativedelta

    ret = relativedelta()
    for m in re.compile(r"([-\d\.]+)([a-zµ]+)").finditer(value.lower()):
        count = float(m.group(1))
        unit = m.group(2)
        match unit:
            case "y":
                ret.years += count
            case "mo":
                ret.months += count
            case "w":
                ret.weeks += count
            case "d":
                ret.days += count
            case "h":
                ret.hours += count
            case "m":
                ret.minutes += count
            case "s":
                ret.seconds += count
            case "ms":
                ret.microseconds += count * 1000
            case "µs":
                ret.microseconds += count
            case "ns":
                ret.microseconds += count / 1000
            case "ps":
                ret.microseconds += count / 1000 / 1000
            case "fs":
                ret.microseconds += count / 1000 / 1000 / 1000
            case "as":
                ret.microseconds += count / 1000 / 1000 / 1000 / 1000
    return ret


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
        return value.lower() == "true"
    elif type_u8 == 4:  # Duration
        return parse_duration(value)
    elif type_u8 == 9:  # Date
        from datetime import datetime
        return datetime.fromisoformat(value).date()
    elif type_u8 == 10:  # Time
        from datetime import datetime
        return datetime.fromisoformat(value).time()
    elif type_u8 == 11:  # DateTime
        from datetime import datetime
        return datetime.fromisoformat(value)
    else:  # Default to text for Error, Html, Image, etc.
        return value


# Single cell case
if w == 1 and h == 1:
    cell_data = cells_data
    if cell_data:
        cell = cell_data[0]
        result = convert_cell_value(cell["v"], cell["t"])
    else:
        result = None
else:
    # Multiple cells - create DataFrame
    data = [[None] * w for _ in range(h)]

    cells_data = cells_data
    for cell in cells_data:
        row = cell["y"] - start_y
        col = cell["x"] - start_x
        if 0 <= row < h and 0 <= col < w:
            data[row][col] = convert_cell_value(cell["v"], cell["t"])

    df = pd.DataFrame(data)

    # Handle headers if needed
    if first_row_header or has_headers:
        if h > 0:
            headers = [str(val) for val in df.iloc[0]]
            df.columns = headers
            df = df.iloc[1:].reset_index(drop=True)

    result = df

result

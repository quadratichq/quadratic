from datetime import date, time, datetime, timedelta
import re
import traceback
from typing import Tuple

import pandas as pd

def attempt_fix_await(code: str) -> str:
    # Insert a "await" keyword between known async functions to improve the UX
    code = re.sub(r"([^a-zA-Z0-9]|^)cells\(", r"\1await cells(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)cell\(", r"\1await cell(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)c\(", r"\1await c(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)getCell\(", r"\1await getCell(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)getCells\(", r"\1await getCells(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)cells\[", r"\1await cells[", code)

    code = code.replace("await await getCell", "await getCell")
    code = code.replace("await await getCells", "await getCells")
    code = code.replace("await await c(", "await c(")
    code = code.replace("await await cell(", "await cell(")
    code = code.replace("await await cells(", "await cells(")
    code = code.replace("await await cells[", "await cells[")

    return code

def to_unix_timestamp(value: pd.Timestamp | date | time | datetime):
    return (value - pd.Timestamp("1970-01-01")) // pd.Timedelta('1s')

def to_interval(value: Tuple[pd.Timestamp | date | time | datetime, pd.Timestamp | date | time | datetime]):
    return (to_unix_timestamp(value.start_time), to_unix_timestamp(value.end_time))

# Convert from python types to quadratic types
def to_quadratic_type(value: int | float | str | bool | pd.Timestamp | date | time | datetime | pd.Period | timedelta | None) -> Tuple[str, str]:
    if value in (None, ""):
        return ("", "blank")
    elif pd.api.types.is_number(value):
        return (str(value), "number")
    elif pd.api.types.is_bool(value):
        return (str(bool(value)), "logical")
    elif pd.api.types.is_datetime64_any_dtype(value) or isinstance(value, (pd.Timestamp, date, time, datetime)):
        return (str(to_unix_timestamp(value)), "instant")
    elif pd.api.types.is_period_dtype(value) or isinstance(value, (pd.Period, timedelta)):
        return (str(to_interval(value)), "duration")
    else :
        return (str(value), "text")

# Convert from quadratic types to python types
def to_python_type(value: str, value_type: str) -> int | float | str | bool:
    if value_type == "number":
        return number_type(value)
    elif value_type == "text":
        return str(value)
    elif value_type == "logical":
        return bool(value)
    else:
        return value

def number_type(value: str) -> int | float | str:
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value

def stack_line_number() -> int:
    return int(traceback.format_stack()[-3].split(", ")[1].split(" ")[1])

def result_to_value(result: Tuple[str, str]) -> int | float | str | bool:
    return to_python_type(result.value, result.type_name)
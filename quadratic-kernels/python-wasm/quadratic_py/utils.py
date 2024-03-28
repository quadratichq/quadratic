import ast
import operator
import re
import traceback
from datetime import date, datetime, time, timedelta
from decimal import Decimal, DecimalException
from typing import Tuple

import numpy as np
import pandas as pd
import pytz


class Blank:
    def __str__(self):
        return str("")

    def __repr__(self):
        return str("")

    def __int__(self):
        return int(0)

    def __float__(self):
        return float(0)

    def __bool__(self):
        return False
    
    def generic_overload(self, other, op):
        if isinstance(other, type(None)):
            return op(None, other)
        elif isinstance(other, str):
            return op("", other)
        else:
            return op(0, other)

    def __add__(self, other):
        return self.generic_overload(other, operator.add)

    def __sub__(self, other):
        return self.generic_overload(other, operator.sub)

    def __mul__(self, other):
        return self.generic_overload(other, operator.mul)

    def __truediv__(self, other):
        return self.generic_overload(other, operator.truediv)

    def __mod__(self, other):
        return self.generic_overload(other, operator.mod)

    def __pow__(self, other):
        return self.generic_overload(other, operator.pow)

    def __eq__(self, other):
        return self.generic_overload(other, operator.eq)

    def __lt__(self, other):
        return self.generic_overload(other, operator.lt)

    def __le__(self, other):
        return self.generic_overload(other, operator.le)

    def __gt__(self, other):
        return self.generic_overload(other, operator.gt)

    def __ge__(self, other):
        return self.generic_overload(other, operator.ge)
    
def attempt_fix_await(code: str) -> str:
    # Insert a "await" keyword between known async functions to improve the UX
    code = re.sub(r"([^a-zA-Z0-9]|^)cells\(", r"\1await cells(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)cell\(", r"\1await cell(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)c\(", r"\1await c(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)getCell\(", r"\1await getCell(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)getCells\(", r"\1await getCells(", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)cells\[", r"\1await cells[", code)
    code = re.sub(r"([^a-zA-Z0-9]|^)rel_await cell\(", r"\1await rel_cell(", code) # intentional
    code = re.sub(r"([^a-zA-Z0-9]|^)rc\(", r"\1await rc(", code)

    code = code.replace("await await getCell", "await getCell")
    code = code.replace("await await getCells", "await getCells")
    code = code.replace("await await c(", "await c(")
    code = code.replace("await await cell(", "await cell(")
    code = code.replace("await await cells(", "await cells(")
    code = code.replace("await await cells[", "await cells[")
    code = code.replace("await await rel_cell[", "await rel_cell(")
    code = code.replace("await await rc[", "await rc(")

    return code

def to_unix_timestamp(value: pd.Timestamp | date | time | datetime):
    return (value - pd.Timestamp("1970-01-01")) // pd.Timedelta('1s')

def to_interval(value: Tuple[pd.Timestamp | date | time | datetime, pd.Timestamp | date | time | datetime]):
    return (str(to_unix_timestamp(value.start_time)), str(to_unix_timestamp(value.end_time)))

def normalize_bool(value: str) -> bool:
    value = re.sub('true', 'True', value, count=1, flags=re.IGNORECASE)
    value = re.sub('false', 'False', value, count=1, flags=re.IGNORECASE)

    return value

# Convert from python types to quadratic types
def to_quadratic_type(value: int | float | str | bool | pd.Timestamp | date | time | datetime | pd.Period | timedelta | None) -> Tuple[str, str]:
    
    try:    
        if value == None or value == "":
            return ("", "blank")
        
        # TODO(ddimaria): this is brittle, refactor
        # TODO(ddimaria): removed because of a request from Luke/Jim to treat all strings as strings
        # if type(value) == str:
        #     value = normalize_bool(value)
        if type(value) == str:
            return (str(value), "text")
            
        value = ast.literal_eval(value)
    except:
        pass
    
    try:
        if type(value) == int or type(value) == float:
            return (str(value), "number")
        elif type(value) == bool:
            return (str(bool(value)), "logical")
        elif isinstance(value, (pd.Timestamp, np.datetime64, date, time, datetime)) or pd.api.types.is_datetime64_dtype(value):
            return (str(to_unix_timestamp(value)), "instant")
        
        # TODO(ddimaria): implement when we implement duration in Rust
        # elif isinstance(value, (pd.Period, np.timedelta64, timedelta)):
        # elif isinstance(value, pd.Period):
        #     return (to_interval(value), "duration")
        else :
            return (str(value), "text")
    except:
        return (str(value), "text")
    

# Convert from quadratic types to python types
def to_python_type(value: str, value_type: str) -> int | float | str | bool:
    try:
        if value_type == "blank":
            return Blank()
        elif value_type == "number":
            return number_type(value)
        elif value_type == "text":
            return str(value)
        elif value_type == "logical":
            return ast.literal_eval(normalize_bool(value))
        elif value_type == "instant":
            return datetime.fromtimestamp(int(value), tz=pytz.utc)
        else:
            return value
    except:
        return value

def detect_stringified_type(string):
    try:
        parsed_object = ast.literal_eval(string)
        return type(parsed_object)
    except (SyntaxError, ValueError):
        return str

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
import ast
import operator
import re
import traceback
from datetime import date, datetime, time, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal, DecimalException
from enum import Enum
from typing import Tuple

import numpy as np
import pandas as pd
import pytz

# type_u8 as per cellvalue.rs
class CellValueType(Enum):
    Blank = 0
    Text = 1
    Number = 2
    Logical = 3
    Duration = 4
    Error = 5
    Html = 6
    Image = 8
    Date = 9
    Time = 10
    DateTime = 11

JsCellValueResult = Tuple[str, CellValueType]

def attempt_fix_await(code: str) -> str:
    # Convert c((x,y), ...) cell((x,y), ...) to cells((x,y), ...)
    code = re.sub(
        r"(^|\W)c(?:ell)?(\([^\(\)]*\([^\)]*\)(?:[^\(\)]*|\([^\)]*\))*\))",
        r"\1cells\2",
        code,
    )  # captures c((x,y), ...) cell((x,y), ...)

    # Remove await from c( cell( cells[ getCells( rel_cell( rc(, as these are now synchronous
    code = re.sub(
        r"(^|\W)(?:await +)(c(?:ells?)?\((?:[^\(\)]*|\([^\)]*\))*\))", r"\1\2", code
    )  # captures c( cell( cells(
    code = re.sub(
        r"(^|\W)(?:await +)(cells\[[^\]]*\])", r"\1\2", code
    )  # captures cells[
    code = re.sub(
        r"(^|\W)(?:await +)(getCells?\((?:[^\(\)]*|\([^\)]*\))*\))", r"\1\2", code
    )  # captures get_cell( get_cells(
    code = re.sub(
        r"(^|\W)(?:await +)(rel_cell\([^\)]*\))", r"\1\2", code
    )  # captures rel_cell(
    code = re.sub(
        r"(^|\W)(?:await +)(rc\((?:[^\(\)]*|\([^\)]*\))*\))", r"\1\2", code
    )  # captures rc(

    return code


def to_iso_format(value: pd.Timestamp | date | time | datetime):
    return value.isoformat()


def to_interval(
    value: Tuple[
        pd.Timestamp | date | time | datetime, pd.Timestamp | date | time | datetime
    ]
):
    return (
        str(to_iso_format(value.start_time)),
        str(to_iso_format(value.end_time)),
    )


def normalize_bool(value: str) -> bool:
    value = re.sub("true", "True", value, count=1, flags=re.IGNORECASE)
    value = re.sub("false", "False", value, count=1, flags=re.IGNORECASE)

    return value


def parse_duration(value: str) -> relativedelta:
    ret = relativedelta()
    for m in re.compile(r'([-\d\.]+)([a-zµ]+)').finditer(value.lower()):
        count = float(m.group(1))
        unit = m.group(2)
        match unit:
            case "y": ret.years += count
            case "mo": ret.months += count
            case "w": ret.weeks += count
            case "d": ret.days += count
            case "h": ret.hours += count
            case "m": ret.minutes += count
            case "s": ret.seconds += count
            case "ms": ret.microseconds += count * 1000
            case "µs": ret.microseconds += count
            case "ns": ret.microseconds += count / 1000
            case "ps": ret.microseconds += count / 1000 / 1000
            case "fs": ret.microseconds += count / 1000 / 1000 / 1000
            case "as": ret.microseconds += count / 1000 / 1000 / 1000 / 1000
    return ret


# Convert from python types to quadratic types
def to_quadratic_type(
    value: (
        int
        | float
        | str
        | bool
        | pd.Timestamp
        | date
        | time
        | datetime
        | timedelta
        | relativedelta
        | None
    ),
) -> JsCellValueResult:
    try:
        if value == None or value == "":
            return ("", CellValueType.Blank.value)  # Use .value to get the integer

        if type(value) == str:
            return (str(value), CellValueType.Text.value)

        value = ast.literal_eval(value)

    except:
        pass

    try:
        if type(value) == int or type(value) == float or isinstance(value, np.number):
            return (str(value), CellValueType.Number.value)
        elif type(value) == bool:
            return (str(bool(value)), CellValueType.Logical.value)
        elif isinstance(value, np.datetime64):
            return (to_iso_format(pd.Timestamp(value)), CellValueType.DateTime.value)
        elif isinstance(value, pd.Timestamp) or pd.api.types.is_datetime64_dtype(value):
            return (to_iso_format(value), CellValueType.DateTime.value)
        elif isinstance(value, datetime):
            return (to_iso_format(value), CellValueType.DateTime.value)
        elif isinstance(value, date):
            return (to_iso_format(value), CellValueType.Date.value)
        elif isinstance(value, time):
            return (to_iso_format(value), CellValueType.Time.value)
        elif isinstance(value, timedelta):
            return (f"{value.days}d {value.seconds}s {value.microseconds}µs", CellValueType.Duration.value)
        elif isinstance(value.normalized(), relativedelta):
            return (
                f"{value.years}y {value.months}mo {value.days}d {value.hours}h {value.minutes}m {value.seconds}s {value.microseconds}µs",
                CellValueType.Duration.value
            )
        else:
            return (str(value), CellValueType.Text.value)
    except Exception as e:
        return (str(value), CellValueType.Text.value)


# Convert from quadratic types to python types
def to_python_type(value: str, type_u8: int) -> int | float | str | bool:
    try:
        match type_u8:
            case CellValueType.Blank.value:
                return None
            case CellValueType.Text.value:
                return str(value)
            case CellValueType.Number.value:
                return number_type(value)
            case CellValueType.Logical.value:
                return ast.literal_eval(normalize_bool(value))
            case CellValueType.Duration.value:
                return parse_duration(value)
            case CellValueType.Date.value:
                return datetime.fromisoformat(value).date()
            case CellValueType.Time.value:
                return datetime.fromisoformat(value).time()
            case CellValueType.DateTime.value:
                return datetime.fromisoformat(value)
            case _:
                return value
    except:
        return value


# Convert from quadratic types to python df types
def to_python_type_df(value: str, type_u8: int) -> int | float | str | bool:
    try:
        match type_u8:
            case CellValueType.Blank.value:
                return None
            case CellValueType.Text.value:
                return str(value)
            case CellValueType.Number.value:
                return number_type(value)
            case CellValueType.Logical.value:
                return ast.literal_eval(normalize_bool(value))
            case CellValueType.Date.value:
                return datetime.fromisoformat(value).date()
            case CellValueType.Time.value:
                return datetime.fromisoformat(value).time()
            case CellValueType.DateTime.value:
                return datetime.fromisoformat(value)
            case _:
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
    return to_python_type(result.v, result.t)

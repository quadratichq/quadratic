import ast
import operator
import re
import traceback
from datetime import date, datetime, time, timedelta
from dateutil.relativedelta import relativedelta
from decimal import Decimal, DecimalException
from typing import Tuple

import numpy as np
import pandas as pd
import pytz


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
) -> Tuple[str, str]:
    try:
        if value == None or value == "":
            return ("", "blank")

        if type(value) == str:
            return (str(value), "text")

        value = ast.literal_eval(value)

    except:
        pass

    try:
        if type(value) == int or type(value) == float or isinstance(value, np.number):
            return (str(value), "number")
        elif type(value) == bool:
            return (str(bool(value)), "logical")
        elif isinstance(value, np.datetime64):
            return (to_iso_format(pd.Timestamp(value)), "date time")
        elif isinstance(value, pd.Timestamp) or pd.api.types.is_datetime64_dtype(value):
            return (to_iso_format(value), "date time")
        elif isinstance(value, datetime):
            return (to_iso_format(value), "date time")
        elif isinstance(value, date):
            return (to_iso_format(value), "date")
        elif isinstance(value, time):
            return (to_iso_format(value), "time")
        elif isinstance(value, timedelta):
            return (f"{value.days}d {value.seconds}s {value.microseconds}µs", "duration")
        elif isinstance(value.normalized(), relativedelta):
            # Exclude `value.weeks` because it is redundant with `value.days`
            return (f"{value.years}y {value.months}mo "
                    f"{value.days}d {value.hours}h {value.minutes}m "
                    f"{value.seconds}s {value.microseconds}µs", "duration")
        else:
            return (str(value), "text")
    except Exception as e:
        return (str(value), "text")


# Convert from quadratic types to python types
def to_python_type(value: str, value_type: str) -> int | float | str | bool:
    try:
        if value_type == "blank":
            return None
        elif value_type == "number":
            return number_type(value)
        elif value_type == "text":
            return str(value)
        elif value_type == "logical":
            return ast.literal_eval(normalize_bool(value))
        elif value_type == "time":
            return datetime.fromisoformat(
                value,
            ).time()
        elif value_type == "date":
            return datetime.fromisoformat(value)
        elif value_type == "date time":
            return datetime.fromisoformat(value)
        elif value_type == "duration":
            return parse_duration(value)
        else:
            return value
    except:
        return value


# Convert from quadratic types to python df types
def to_python_type_df(value: str, value_type: str) -> int | float | str | bool:
    try:
        if value_type == "blank":
            return None
        elif value_type == "number":
            return number_type(value)
        elif value_type == "text":
            return str(value)
        elif value_type == "logical":
            return ast.literal_eval(normalize_bool(value))
        elif value_type == "time":
            return str(value)
        elif value_type == "date":
            return pd.to_datetime(value)
        elif value_type == "date time":
            return pd.to_datetime(value)
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

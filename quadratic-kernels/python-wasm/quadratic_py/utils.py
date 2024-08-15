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
        | pd.Period
        | timedelta
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
        elif isinstance(
            value, (pd.Timestamp, np.datetime64, date, time, datetime)
        ) or pd.api.types.is_datetime64_dtype(value):
            return (str(to_iso_format(value)), "date")

        # TODO(ddimaria): implement when we implement duration in Rust
        # elif isinstance(value, (pd.Period, np.timedelta64, timedelta)):
        # elif isinstance(value, pd.Period):
        #     return (to_interval(value), "duration")
        else:
            return (str(value), "text")
    except:
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
            return datetime.fromisoformat(str(value), tz=pytz.utc).time()
        elif value_type == "date":
            return datetime.fromisoformat(str(value), tz=pytz.utc)
        elif value_type == "datetime":
            return datetime.fromisoformat(str(value), tz=pytz.utc)
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

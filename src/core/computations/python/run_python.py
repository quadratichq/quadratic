from unicodedata import decimal
import GetCellsDB

import sys
import traceback
import pyodide
import asyncio
import micropip
import pandas as pd
import operator

from io import StringIO
from contextlib import redirect_stdout
from decimal import Decimal, DecimalException

micropip.install("autopep8")

# todo separate this file out into a Python Package
# https://pyodide.org/en/stable/usage/loading-custom-python-code.html


def attempt_fix_await(code):
    code = code.replace("getCell", "await getCell")
    code = code.replace("await await getCell", "await getCell")

    code = code.replace("c(", "await c(")
    code = code.replace("await await c(", "await c(")
    return code


def strtobool(val):
    """Convert a string representation of truth to true (1) or false (0).
    True values are 'y', 'yes', 't', 'true', 'on', and '1'; false values
    are 'n', 'no', 'f', 'false', 'off', and '0'.  Raises ValueError if
    'val' is anything else.
    """
    val = val.lower()
    if val in ("y", "yes", "t", "true", "on", "1"):
        return True
    elif val in ("n", "no", "f", "false", "off", "0"):
        return False
    else:
        raise ValueError("invalid truth value %r" % (val,))


class Cell:
    def __init__(self, object):
        self.x = object.x
        self.y = object.y
        self.value = object.value

    def __str__(self):
        return str(self.value)

    def __repr__(self):
        return str(self.value)

    def generic_overload(self, other, op):
        if type(other) is Cell:
            try:
                return op(Decimal(self.value), Decimal(other.value))
            except DecimalException:
                return op(self.value, other.value)
        else:
            try:
                return op(Decimal(self.value), Decimal(other))
            except DecimalException:
                return op(self.value, other)

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

    def __bool__(self):
        return strtobool(self.value)


class Table:
    def __init__(self, cells):
        self.p0 = None
        self.p1 = None
        self.has_headers = False

    def to_df(self):
        raise NotImplementedError()

    def to_list(self):
        raise NotImplementedError()

    def to_2darray(self):
        raise NotImplementedError()

    # TODO define iterator


async def run_python(code):

    cells_accessed = []

    async def getCells(p0, p1):
        # mark cells this formula accesses
        for x in range(p0[0], p1[0] + 1):
            for y in range(p0[1], p1[1] + 1):
                cells_accessed.append([x, y])

        cells = await GetCellsDB(p0[0], p0[1], p1[0], p1[1])

        # TODO return as Table

        return cells

        raise Exception("Must select a return type.")

    async def getCell(p_x, p_y):
        # mark cell this formula accesses
        cells_accessed.append([p_x, p_y])
        result = await GetCellsDB(p_x, p_y, p_x, p_y)

        if len(result):
            return Cell(result[0])
        else:
            return None

    async def c(p0_x, p0_y, p1_x=None, p1_y=None):
        if p1_x is None:
            return await getCell(p0_x, p0_y)
        else:
            return await getCells(p0_x, p0_y, p1_x, p1_y)

    globals = {}
    locals = {"getCells": getCells, "getCell": getCell, "c": c}

    sout = StringIO()
    output_value = None

    try:
        # Capture STDOut to sout
        with redirect_stdout(sout):
            output_value = await pyodide.eval_code_async(
                attempt_fix_await(code), globals, locals
            )

    except SyntaxError as err:
        error_class = err.__class__.__name__
        detail = err.args[0]
        line_number = err.lineno
    except Exception as err:
        error_class = err.__class__.__name__
        detail = err.args[0]
        cl, exc, tb = sys.exc_info()
        line_number = traceback.extract_tb(tb)[-1][1]
    else:
        # Successfully Created a Result
        import autopep8

        if output_value is None:
            output_value = locals.get("result", None)

        array_output = None
        if isinstance(output_value, list):
            array_output = output_value

        return {
            "output_value": str(output_value),
            "array_output": array_output,
            "cells_accessed": cells_accessed,
            "input_python_std_out": sout.getvalue(),
            "input_python_evaluation_success": True,
            "input_python_stack_trace": None,
            "formatted_code": autopep8.fix_code(
                code, options={"ignore": ["E402"]}
            ),  # Ignore E402 : otherwise breaks imports
        }

    return {
        "output_value": output_value,
        "array_output": None,
        "cells_accessed": cells_accessed,
        "input_python_std_out": sout.getvalue(),
        "input_python_evaluation_success": False,
        "input_python_stack_trace": "{} on line {}: {}".format(
            error_class, line_number, detail
        ),
        "formatted_code": code,
    }


print("environment ready")

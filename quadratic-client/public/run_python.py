import asyncio
import inspect
import itertools
import operator
import os
import re
import sys
import traceback
from contextlib import redirect_stdout
from decimal import Decimal, DecimalException
from io import StringIO

import getCellsDB
import micropip
import numpy as np
import pandas as pd
import pyodide

# todo separate this file out into a Python Package
# https://pyodide.org/en/stable/usage/loading-custom-python-code.html

def attempt_fix_await(code):
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

def stack_line_number():
    return int(traceback.format_stack()[-3].split(", ")[1].split(" ")[1])

class Cell:
    def __init__(self, object):
        self.value = object.value

    def __str__(self):
        return str(self.value)

    def __repr__(self):
        return str(self.value)

    def __int__(self):
        return int(self.value or 0)

    def __float__(self):
        self_only_num = "".join(_ for _ in str(self) if _ in "+-,.1234567890")
        return float(self_only_num or 0)

    def generic_overload(self, other, op):
        if type(other) is Cell:
            try:
                return op(Decimal(self.value), Decimal(other.value))
            except (DecimalException, TypeError):
                return op(self.value, other.value)
        else:
            try:
                return op(Decimal(self.value), Decimal(other))
            except (DecimalException, TypeError):
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
        self.sheet = None
        self.has_headers = False

    def to_df(self):
        raise NotImplementedError()

    def to_list(self):
        raise NotImplementedError()

    def to_2darray(self):
        raise NotImplementedError()

    # TODO define iterator


def not_cell(item):
    if isinstance(item, Cell):
        return item.value
    return item

def ensure_not_cell(item):
    if isinstance(item, list):
        return [ensure_not_cell(x) for x in item]
    return not_cell(item)

def _get_user_frames() -> list[inspect.FrameInfo] | None:
    rev_frames = reversed(inspect.stack())
    try:
        rev_frames = itertools.dropwhile(
            lambda frame: not ("/_pyodide/" in frame.filename and frame.function == "eval_code_async"),
            rev_frames,
        )
        rev_frames = itertools.dropwhile(
            lambda frame: frame.filename != "<exec>", rev_frames
        )
        rev_frames = itertools.takewhile(
            lambda frame: frame.filename == "<exec>", rev_frames
        )

        return list(reversed(list(rev_frames)))
    except:
        return None

def _line_number_from_traceback() -> int:
    cl, exc, tb = sys.exc_info()
    line_number = traceback.extract_tb(tb)[-1].lineno
    return line_number

def _get_return_line(code: str) -> int:
    code = code.rstrip()
    return code.count("\n") + 1

def _error_result(
    error: Exception, code: str, cells_accessed: list[list], sout: StringIO, line_number: int,
) -> dict:
    error_class = error.__class__.__name__
    detail = error.args[0]
    return {
        "output_value": None,
        "array_output": None,
        "cells_accessed": cells_accessed,
        "std_out": sout.getvalue(),
        "success": False,
        "input_python_stack_trace": "{} on line {}: {}".format(
            error_class, line_number, detail
        ),
        "line_number": line_number,
        "formatted_code": code,
    }

class FigureDisplayError(Exception):
    def __init__(self, message: str, *, source_line: int):
        super().__init__(message)
        self._source_line = source_line

    @property
    def source_line(self) -> int:
        return self._source_line

class _FigureHolder:
    def __init__(self):
        self._result = None
        self._result_set_from_line = None

    def set_result(self, figure) -> None:
        user_call_frames = _get_user_frames()
        current_result_set_from_line = (
            user_call_frames[0].lineno if user_call_frames is not None else "unknown"
        )

        if self._result is not None:
            raise FigureDisplayError(
                f"Cannot produce multiple figures from a single cell. "
                f"First produced on line {self._result_set_from_line}, "
                f"then on {current_result_set_from_line}",
                source_line=current_result_set_from_line
            )

        self._result = figure
        self._result_set_from_line = current_result_set_from_line

    @property
    def result(self):
        return self._result

    @property
    def result_set_from_line(self) -> int | None:
        return self._result_set_from_line

async def _intercept_plotly_html(code) -> _FigureHolder | None:
    if "plotly" not in pyodide.code.find_imports(code):
        return None

    await micropip.install("plotly")
    import plotly.io

    # TODO: It would be nice if we could prevent the user from setting the default renderer
    plotly.io.renderers.default = "browser"
    figure_holder = _FigureHolder()

    plotly.io._base_renderers.open_html_in_browser = _make_open_html_patch(figure_holder.set_result)

    return figure_holder

def _make_open_html_patch(figure_saver):
    def open_html_in_browser(html, *args, **kwargs):
        figure_saver(html)

    return open_html_in_browser

async def run_python(code):
    cells_accessed = []

    async def getCells(p0, p1, sheet=None, first_row_header=False):
        # mark cells as accessed by this cell
        for x in range(p0[0], p1[0] + 1):
            for y in range(p0[1], p1[1] + 1):
                cells_accessed.append([x, y, sheet])

        # Get Cells
        cells = await getCellsDB(p0[0], p0[1], p1[0], p1[1], sheet, int(stack_line_number()))

        # Create empty df of the correct size
        df = pd.DataFrame(
            index=range(p1[1] - p0[1] + 1),
            columns=range(p1[0] - p0[0] + 1),
        )

        # Fill DF
        x_offset = p0[0]
        y_offset = p0[1]
        for cell in cells:
            df.at[cell.y - y_offset, cell.x - x_offset] = cell.value

        # Move the first row to the header
        if first_row_header:
            df.rename(columns=df.iloc[0], inplace=True)
            df.drop(df.index[0], inplace=True)
            df.reset_index(drop=True, inplace=True)

        return df

    async def getCell(p_x, p_y, sheet=None):
        cells_accessed.append([p_x, p_y, sheet])
        result = await getCellsDB(p_x, p_y, p_x, p_y, sheet, int(stack_line_number()))

        if len(result):
            return Cell(result[0])
        else:
            return None

    class CellFunc:
        @staticmethod
        def __call__(p0_x, p0_y, sheet=None):
            return getCell(p0_x, p0_y, sheet)

    class CellsFunc:
        @staticmethod
        def __call__(p0, p1, sheet=None, first_row_header=False):
            return getCells(p0, p1, sheet, first_row_header)

        @staticmethod
        async def __getitem__(item):
            if type(item) == tuple and (len(item) == 2 or len(item) == 3):
                row_idx = item[0]
                col_idx = item[1]
                sheet = item[2]

                if type(row_idx) == type(col_idx) == int:
                    return getCell(row_idx, col_idx, sheet)

                elif type(row_idx) in (int, slice) and type(col_idx) in (int, slice):
                    if type(row_idx) == slice:
                        row_start = row_idx.start
                        row_stop = row_idx.stop
                        row_step = row_idx.step
                    else:
                        row_start = row_idx
                        row_stop = row_idx + 1
                        row_step = None

                    if type(col_idx) == slice:
                        col_start = col_idx.start
                        col_stop = col_idx.stop
                        col_step = col_idx.step
                    else:
                        col_start = col_idx
                        col_stop = col_idx + 1
                        col_step = None

                    if row_step is not None or col_step is not None:
                        raise IndexError("Slice step-size parameter not supported")

                    return getCells(
                        (col_start, row_start),
                        (col_stop - 1, row_stop - 1),
                        sheet,
                        first_row_header=False,
                    )

                else:
                    raise IndexError("Only int and slice type indices supported")
            else:
                raise IndexError(
                    """Expected usage:
                        1. cells[row                        , col                        , sheet?]
                        2. cells[row_slice_min:row_slice_max, col                        , sheet?]
                        3. cells[row                        , col_slice_min:col_slice_max, sheet?]
                        4. cells[row_slice_min:row_slice_max, col_slice_min:col_slice_max, sheet?]
                        """
                )

    globals = {
        "getCells": getCells,
        "getCell": getCell,
        "c": CellFunc(),
        "result": None,
        "cell": CellFunc(),
        "cells": CellsFunc(),
    }

    sout = StringIO()
    output_value = None

    try:
        plotly_html = await _intercept_plotly_html(code)

        # Capture STDOut to sout
        with redirect_stdout(sout):
            output_value = await pyodide.code.eval_code_async(
                attempt_fix_await(code),
                globals=globals,
                return_mode="last_expr_or_assign",
                quiet_trailing_semicolon=False,
            )

    except FigureDisplayError as err:
        return _error_result(err, code, cells_accessed, sout, err.source_line)
    except SyntaxError as err:
        return _error_result(err, code, cells_accessed, sout, err.lineno)
    except Exception as err:
        return _error_result(err, code, cells_accessed, sout, _line_number_from_traceback())
    else:
        # Successfully Created a Result
        await micropip.install(
            "autopep8"
        )  # fixes a timing bug where autopep8 is not yet installed when attempting to import
        import autopep8

        # return array_output if output is an array
        array_output = None
        if isinstance(output_value, list):
            if len(output_value) > 0:
                array_output = output_value
            else:
                output_value = ''

        # Convert DF to array_output
        if isinstance(output_value, pd.DataFrame):
            # If output_value columns is not the default (RangeIndex)
            if type(output_value.columns) != pd.core.indexes.range.RangeIndex:
                # Return Column names and values
                array_output = [
                    output_value.columns.tolist()
                ] + output_value.values.tolist()

            else:
                # convert nan to None, return PD values list
                array_output = output_value.where(
                    output_value.notnull(), None
                ).values.tolist()

        try:
            import plotly
            if isinstance(output_value, plotly.graph_objs._figure.Figure):
                output_value = output_value.to_html()
        except:
            pass

        # Convert Pandas.Series to array_output
        if isinstance(output_value, pd.Series):
            array_output = output_value.to_numpy().tolist()

        # Attempt to format code
        formatted_code = code
        try:
            formatted_code = autopep8.fix_code(
                code, options={"ignore": ["E402"]}
            )  # Ignore E402 : otherwise breaks imports
        except Exception:
            pass

        if plotly_html is not None and plotly_html.result is not None:
            if output_value is not None or array_output is not None:
                err = RuntimeError(
                    "Cannot return result from cell that has displayed a figure "
                    f"(displayed on line {plotly_html.result_set_from_line})"
                )

                return _error_result(err, code, cells_accessed, sout, _get_return_line(code))
            else:
                output_value = plotly_html.result

        # removes output_value if there's an array or None
        if array_output or output_value is None:
            output_value = ""

        return {
            "output_value": str(output_value),
            "array_output": ensure_not_cell(array_output),
            "cells_accessed": cells_accessed,
            "std_out": sout.getvalue(),
            "success": True,
            "input_python_stack_trace": None,
            "formatted_code": formatted_code,
        }

print("[Python WebWorker] initialized")

from datetime import date, time, datetime, timedelta
import re
import traceback
from contextlib import redirect_stdout, redirect_stderr
from decimal import Decimal, DecimalException
from io import StringIO

import getCellsDB
import micropip
import pandas as pd
import pyodide

from quadratic_py import code_trace, plotly_patch


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

def to_unix_timestamp(value):
    return (value - pd.Timestamp("1970-01-01")) // pd.Timedelta('1s')

def to_interval(value):
    return (to_unix_timestamp(value.start_time), to_unix_timestamp(value.end_time))

# Convert from python types to quadratic types
def to_quadratic_type(value):
    if value in (None, ""):
        return (None, "blank")
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
def to_python_type(value, value_type):
    if value_type == "number":
        return number_type(value)
    elif value_type == "text":
        return str(value)
    elif value_type == "logical":
        return bool(value)
    else:
        return value

def number_type(value):
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value

def stack_line_number():
    return int(traceback.format_stack()[-3].split(", ")[1].split(" ")[1])

def error_result(
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

async def run_python(code):
    cells_accessed = []
        
    def result_to_value(result):
        return to_python_type(result.value, result.type_name)

    async def getCells(p0, p1, sheet=None, first_row_header=False):
        # mark cells as accessed by this cell
        for x in range(p0[0], p1[0] + 1):
            for y in range(p0[1], p1[1] + 1):
                cells_accessed.append([x, y, sheet])

        # Get Cells
        cells = await getCellsDB(p0[0], p0[1], p1[0], p1[1], sheet, int(stack_line_number()))

        cell_range_width = p1[0] - p0[0] + 1
        cell_range_height = p1[1] - p0[1] + 1

        # return a panda series for a 1d array of cells     
        if cell_range_width == 1 or cell_range_height == 1:
            cell_list = [result_to_value(cell) for cell in cells]        
            return pd.Series(cell_list)

        # Create empty df of the correct size
        df = pd.DataFrame(  
            index=range(cell_range_height),
            columns=range(cell_range_width),
        )

        # Fill DF
        x_offset = p0[0]
        y_offset = p0[1]

        for cell in cells:
            value = to_python_type(cell.value, cell.type_name)
            df.at[cell.y - y_offset, cell.x - x_offset] = value

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
            return result_to_value(result[0])
        else:
            return None

    globals = {
        "getCells": getCells,
        "getCell": getCell,
        "c": getCell,
        "result": None,
        "cell": getCell,
        "cells": getCells,
    }

    sout = StringIO()
    serr = StringIO()
    output_value = None

    try:
        plotly_html = await plotly_patch.intercept_plotly_html(code)

        # Capture STDOut to sout
        with redirect_stdout(sout):
            with redirect_stderr(serr):
                # preprocess and fix code
                output_value = await pyodide.code.eval_code_async(
                    attempt_fix_await(code),
                    globals=globals,
                    return_mode="last_expr_or_assign",
                    quiet_trailing_semicolon=False,
                )

    except plotly_patch.FigureDisplayError as err:
        return error_result(err, code, cells_accessed, sout, err.source_line)
    except SyntaxError as err:
        return error_result(err, code, cells_accessed, sout, err.lineno)
    except Exception as err:
        return error_result(err, code, cells_accessed, sout, code_trace.line_number_from_traceback())
    else:
        # Successfully Created a Result
        await micropip.install(
            "autopep8"
        )  # fixes a timing bug where autopep8 is not yet installed when attempting to import
        import autopep8

        # return array_output if output is an array
        array_output = None
        output_size = None

        # TODO(ddimaria): figure out if we need to covert back to a list for array_output
        # We should have a single output
        if isinstance(output_value, list):
            if len(output_value) > 0:
                array_output = output_value
                output_size = (1, len(output_value))
            else:
                output_value = ''

        if isinstance(output_value, pd.Series):
            output_size = (1, len(output_value))

        # Convert DF to array_output
        if isinstance(output_value, pd.DataFrame):
            output_size = output_value.shape
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

                return error_result(
                    err, code, cells_accessed, sout, code_trace.get_return_line(code)
                )
            else:
                output_value = plotly_html.result

        typed_array_output = None

        if array_output is not None:
            typed_array_output = []
            is_2d_array = isinstance(array_output[0], list)

            # insure that all rows are the same length
            if not is_2d_array:
                typed_array_output = list(map(to_quadratic_type, array_output))
            else:
                length_1d = len(array_output)
                length_2d = max(len(row) for row in array_output)
                
                # TODO(ddimaria): is this efficient?
                typed_array_output = [[0 for i in range(length_2d)] for j in range(length_1d)]

                for row in range(0, length_1d):
                    col_length_2d = len(array_output[row])
                    for col in range(0, length_2d):
                        if col > col_length_2d - 1:
                            typed_array_output[row][col] = (None, "blank")
                        else:
                            typed_array_output[row][col] = to_quadratic_type(array_output[row][col])


        # removes output_value if there's an array or None
        if array_output is not None or output_value is None:
            output_value = None
        else:
            output_value = to_quadratic_type(output_value)

        return {
            "output": output_value,
            "array_output": typed_array_output,
            "output_size": output_size,
            "cells_accessed": cells_accessed,
            "std_out": sout.getvalue(),
            "std_err": serr.getvalue(),
            "success": True,
            "input_python_stack_trace": None,
            "formatted_code": formatted_code,
        }

print("[Python WebWorker] initialized")

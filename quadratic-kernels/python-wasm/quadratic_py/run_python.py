from contextlib import redirect_stdout, redirect_stderr
from io import StringIO
from typing import Tuple

from .quadratic_api.quadratic import getCell, getCells, pos
from .utils import attempt_fix_await, to_quadratic_type
import micropip
import pandas as pd
import pyodide

from quadratic_py import code_trace, plotly_patch


cells_accessed = []

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

# Wrapper to getCell() to capture cells_accessed
async def getCellInner(p_x: int, p_y: int, sheet: str=None) -> int | float | str | bool | None:
    cells_accessed.append([p_x, p_y, sheet])

    return await getCell(p_x, p_y, sheet)

# Wrapper to getCells() to capture cells_accessed
async def getCellsInner(p0: Tuple[int, int], p1: Tuple[int, int], sheet: str=None, first_row_header: bool=False) -> pd.DataFrame:
    # mark cells as accessed by this cell
    for x in range(p0[0], p1[0] + 1):
        for y in range(p0[1], p1[1] + 1):
            cells_accessed.append([x, y, sheet])

    return await getCells(p0, p1, sheet, first_row_header)
    
async def getPosInner() -> Tuple[int, int] | None:
    (x, y) = await pos()
    cells_accessed.append([x, y, None])

    return (x, y)

globals = {
    "getCells": getCellsInner,
    "getCell": getCellInner,
    "c": getCellInner,
    "result": None,
    "cell": getCellInner,
    "cells": getCellsInner,
    "pos": getPosInner,
}

async def run_python(code: str):
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
        output_type = type(output_value).__name__
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
            # flip the dataframe shape
            shape = output_value.shape
            output_size = (shape[1], shape[0])
            
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
                output_type = "Chart"
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
                output_type = "Chart"

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
                            typed_array_output[row][col] = ("", "blank")
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
            "output_type": output_type,
            "output_size": output_size,
            "cells_accessed": cells_accessed,
            "std_out": sout.getvalue(),
            "std_err": serr.getvalue(),
            "success": True,
            "input_python_stack_trace": None,
            "code": code,
            "formatted_code": formatted_code,
        }

print("[Python WebWorker] initialized")

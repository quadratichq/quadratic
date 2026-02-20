from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from typing import Tuple

import micropip
import pandas as pd
import pyodide
from quadratic_py import code_trace, plotly_patch, process_output

from .quadratic_api.quadratic import (getCell, getCells, q, rc, rel_cell,
                                      rel_cells)
from .transform_async import add_await_to_cell_calls
from .utils import attempt_fix_await


def error_result(
    error: Exception, code: str, sout: StringIO, line_number: int,
) -> dict:
    error_class = error.__class__.__name__
    detail = error.args[0]
    return {
        "std_out": sout.getvalue(),
        "success": False,
        "input_python_stack_trace": "{} on line {}: {}".format(
            error_class, line_number, detail
        ),
        "line_number": line_number,
        "formatted_code": code,
    }

async def run_python(code: str, pos: Tuple[int, int]):
    globals = {
        "getCells": getCells,
        "getCell": getCell,
        "c": getCell,
        "result": None,
        "cell": getCell,
        "cells": getCells,
        "rel_cell": rel_cell,
        "rel_cells": rel_cells,
        "rc": rc,
        "q": q,
    }

    sout = StringIO()
    serr = StringIO()
    output_value = None
    globals['q'] = q(pos)

    # Check if SharedArrayBuffer is available
    # If not, we need to transform q.cells() calls to add await
    try:
        import hasSharedArrayBuffer
        has_sab = hasSharedArrayBuffer()
    except:
        # Fallback: assume SAB is available if module not found
        has_sab = True

    # Transform code to add await to q.cells() calls when SAB is not available
    transformed_code = code
    if not has_sab:
        transformed_code = add_await_to_cell_calls(code)

    try:
        plotly_html = await plotly_patch.intercept_plotly_html(transformed_code)

        # Capture STDOut to sout
        with redirect_stdout(sout):
            with redirect_stderr(serr):
                # preprocess and fix code
                output_value = await pyodide.code.eval_code_async(
                    attempt_fix_await(transformed_code),
                    globals=globals,
                    return_mode="last_expr_or_assign",
                    quiet_trailing_semicolon=False,
                )

    except plotly_patch.FigureDisplayError as err:
        return error_result(err, code, sout, err.source_line)
    except SyntaxError as err:
        return error_result(err, code, sout, err.lineno)
    except Exception as err:
        return error_result(err, code, sout, code_trace.line_number_from_traceback())
    else:
        # Process the output
        output = process_output.process_output_value(output_value)
        array_output = output["array_output"]
        output_value = output["output_value"]
        output_type = output["output_type"]
        output_size = output["output_size"]
        typed_array_output = output["typed_array_output"]

        # Plotly HTML
        if plotly_html is not None and plotly_html.result is not None:
            if output_value is not None or array_output is not None:
                err = RuntimeError(
                    "Cannot return result from cell that has displayed a figure "
                    f"(displayed on line {plotly_html.result_set_from_line})"
                )

                return error_result(
                    err, code, sout, code_trace.get_return_line(code)
                )
            else:
                output_value = (plotly_html.result, 'text')
                output_type = "Chart"

        return {
            "output": output_value,
            "array_output": typed_array_output,
            "output_type": output_type,
            "output_size": output_size,
            "std_out": sout.getvalue(),
            "std_err": serr.getvalue(),
            "success": True,
            "input_python_stack_trace": None,
            "code": code,
            "formatted_code": code,
            "has_headers": output["has_headers"],
        }

print("[Python WebWorker] initialized")

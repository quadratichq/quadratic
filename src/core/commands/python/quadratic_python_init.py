import GetCellsDB

import sys
import traceback
import pyodide
import asyncio

from io import StringIO
from contextlib import redirect_stdout


async def getCells(p0_x, p0_y, p1_x, p1_y):
    return await GetCellsDB(p0_x, p0_y, p1_x, p1_y)


async def run_python(code):
    globals = {"GetCellsDB": GetCellsDB, "getCells": getCells}
    locals = {}

    sout = StringIO()
    output_value = None

    try:
        # Capture STDOut to sout
        with redirect_stdout(sout):
            output_value = await pyodide.eval_code_async(code, globals, locals)

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
        return str(
            {
                "output_value": output_value or locals.get("result", ""),
                "input_python_std_out": sout.getvalue(),
                "input_python_evaluation_success": True,
                "input_python_stack_trace": None,
            }
        )

    return str(
        {
            "output_value": output_value,
            "input_python_std_out": sout.getvalue(),
            "input_python_evaluation_success": False,
            "input_python_stack_trace": "{} on line {}: {}".format(
                error_class, line_number, detail
            ),
        }
    )


print("environment ready")

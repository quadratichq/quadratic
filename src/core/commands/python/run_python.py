import GetCellsDB

import sys
import traceback
import pyodide
import asyncio

from io import StringIO
from contextlib import redirect_stdout


async def run_python(code):

    cells_accessed = []

    async def getCells(p0_x, p0_y, p1_x, p1_y):
        for x in range(p0_x, p1_x):
            for y in range(p0_y, p1_y):
                cells_accessed.append([x, y])
        return await GetCellsDB(p0_x, p0_y, p1_x, p1_y)

    async def getCell(p_x, p_y):
        cells_accessed.append([p_x, p_y])
        result = await GetCellsDB(p_x, p_y, p_x, p_y)

        if len(result):
            return result[0]
        else:
            return None

    globals = {}
    locals = {"getCells": getCells, "getCell": getCell}

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
                "cells_accessed": cells_accessed,
                "input_python_std_out": sout.getvalue(),
                "input_python_evaluation_success": True,
                "input_python_stack_trace": None,
            }
        )

    return str(
        {
            "output_value": output_value,
            "cells_accessed": cells_accessed,
            "input_python_std_out": sout.getvalue(),
            "input_python_evaluation_success": False,
            "input_python_stack_trace": "{} on line {}: {}".format(
                error_class, line_number, detail
            ),
        }
    )


print("environment ready")

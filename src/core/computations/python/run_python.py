import GetCellsDB

import sys
import traceback
import pyodide
import asyncio
import micropip


from io import StringIO
from contextlib import redirect_stdout

micropip.install("autopep8")


def attempt_fix_await(code):
    code = code.replace("getCell", "await getCell")
    code = code.replace("await await getCell", "await getCell")
    return code


async def run_python(code):

    cells_accessed = []

    async def getCells(p0_x, p0_y, p1_x, p1_y):
        for x in range(p0_x, p1_x + 1):
            for y in range(p0_y, p1_y + 1):
                cells_accessed.append([x, y])
        return await GetCellsDB(p0_x, p0_y, p1_x, p1_y)

    async def getCell(p_x, p_y):
        cells_accessed.append([p_x, p_y])
        result = await GetCellsDB(p_x, p_y, p_x, p_y)

        if len(result):
            return result[0]
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

        output_value = output_value or locals.get("result", None)

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

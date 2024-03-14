import importlib
import inspect
import sys
import unittest
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import Mock, patch, MagicMock, AsyncMock
from quadratic_py.utils import attempt_fix_await, to_quadratic_type

import pandas as pd
import numpy as np
from datetime import datetime

#  Mock definitions
class Cell:
    def __init__(self, x, y, value, type_name):
        self.x = x
        self.y = y
        self.value = value
        self.type_name = type_name

class RelCellResult:
    def __init__(self, value, cells_accessed):
        self.value = value
        self.cells_accessed = cells_accessed

async def mock_GetCellsDB(x1: int, y1: int, x2: int, y2: int, sheet: str=None, line: int=False):
    out = []

    for x in range(x1, x2 + 1):
        for y in range(y1, y2 + 1):
            out.append(Cell(x, y, f"hello {x}", "string"))

    return out

async def mock_GetPos() -> tuple[int, int]:
    return (0, 0)

async def mock_GetRelCell(x: int, y: int, line: int=False):
    result = [Cell(x, y, "hello", "string")]
    cells_accessed = (0, 0)
    return RelCellResult(result, cells_accessed)

class mock_micropip:
    async def install(name):
        return __import__(name)

async def mock_fetch_module(source: str):
    return __import__(source)

    
# mock modules needed to import run_python
sys.modules["pyodide"] = MagicMock()
sys.modules["pyodide.code"] = MagicMock()
sys.modules["getCellsDB"] = mock_GetCellsDB
sys.modules["getPos"] = mock_GetPos
sys.modules["getRelCell"] = mock_GetRelCell
sys.modules["micropip"] = AsyncMock()
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.io"] = MagicMock()
sys.modules["autopep8"] = MagicMock()
sys.modules["autopep8.fix_code"] = MagicMock()

# import after mocks to in order to use them
from quadratic_py import run_python, code_trace
from quadratic_py.quadratic_api.quadratic import getCells, pos, rel_cell

run_python.fetch_module = mock_fetch_module

class value_object:
    def __init__(self, x, y, value):
        self.x = x
        self.y = y
        self.value = value

class TestTesting(IsolatedAsyncioTestCase):
    async def test_run_python(self):

        result = await run_python.run_python("1 + 1")

        # NOTE: this approach bypasses the entire env of Pyodide.
        # We should make the run_python e2e tests run via playwright
        self.assertEqual(result.get("success"), False)

    def test_attempt_fix_await(self):
        self.assertEqual(attempt_fix_await("1 + 1"), "1 + 1")

        # simple adding await
        self.assertEqual(attempt_fix_await("a = cells(0, 0)"), "a = await cells(0, 0)")
        self.assertEqual(attempt_fix_await("a = cell(0, 0)"), "a = await cell(0, 0)")
        self.assertEqual(attempt_fix_await("a = c(0, 0)"), "a = await c(0, 0)")
        self.assertEqual(attempt_fix_await("a = rel_cell(0, 0)"), "a = await rel_cell(0, 0)")
        self.assertEqual(
            attempt_fix_await("a = getCells(0, 0)"), "a = await getCells(0, 0)"
        )

        # simple already has await
        self.assertEqual(
            attempt_fix_await("a = await cells(0, 0)"), "a = await cells(0, 0)"
        )
        self.assertEqual(
            attempt_fix_await("a = await cell(0, 0)"), "a = await cell(0, 0)"
        )
        self.assertEqual(attempt_fix_await("a = await c(0, 0)"), "a = await c(0, 0)")
        self.assertEqual(
            attempt_fix_await("a = await getCells(0, 0)"), "a = await getCells(0, 0)"
        )

        # other
        self.assertEqual(attempt_fix_await("a = cac(0, 0)"), "a = cac(0, 0)")
        self.assertEqual(attempt_fix_await("c(0, 0)"), "await c(0, 0)")
        self.assertEqual(attempt_fix_await("int(c(0,0))"), "int(await c(0,0))")
        self.assertEqual(
            attempt_fix_await("float((await c(2, -4)).value)"),
            "float((await c(2, -4)).value)",
        )
        self.assertEqual(
            attempt_fix_await("c(0, 0)\nc(0, 0)"), "await c(0, 0)\nawait c(0, 0)"
        )


class TestImports(TestCase):
    def test_example_requirements(self):
        # Validates that dependencies which are used in examples can be imported
        # This is not perfect, but it should help protect against breaking example imports
        importlib.import_module("numpy")
        importlib.import_module("pandas")
        importlib.import_module("requests")


class TestErrorMessaging(TestCase):
    def test_get_user_frames(self):
        user_frame_1 = Mock(filename="<exec>", lineno=987, function="<module>")
        user_frame_2 = Mock(filename="<exec>", lineno=123, function="some_user_func")

        frames = [
            Mock(filename="<exec>", lineno=234, function="open_html_in_browser"),
            Mock(
                filename="/lib/pythonSomeVersion/site-packages-plotly/io/_renderers.py",
                lineno=123,
                function="fake_plotly_func"
            ),
            user_frame_2,
            user_frame_1,
            Mock(filename='/lib/pythonSomeVersionZip/_pyodide/_base.py', lineno=444, function='run_async'),
            Mock(filename='/lib/pythonSomeVersionZip/_pyodide/_base.py', lineno=333, function='eval_code_async'),
            Mock(filename='<exec>', lineno=222, function='run_python'),
            Mock(filename='/lib/pythonSomeVersionZip/pyodide/webloop.py', lineno=111, function='run_handle'),
        ]

        expected_user_frames = [user_frame_2, user_frame_1]

        with patch.object(inspect, "stack", return_value=frames):
            actual_user_frames = code_trace.get_user_frames()
            assert actual_user_frames == expected_user_frames

    def test_get_return_line(self):
        example_code = r"""import itertools
        
        print("Counting to 0\n\n\n")
        next(itertools.count())
        
        
        """

        assert code_trace.get_return_line(example_code) == 4

    def test_error_result(self):
        err = RuntimeError("Test message")
        code = Mock()
        cells_accessed = Mock()
        sout = Mock(getvalue=Mock())
        line_number = 42

        assert run_python.error_result(err, code, cells_accessed, sout, line_number) == {
            "output_value": None,
            "array_output": None,
            "cells_accessed": cells_accessed,
            "std_out": sout.getvalue.return_value,
            "success": False,
            "input_python_stack_trace": "RuntimeError on line 42: Test message",
            "line_number": 42,
            "formatted_code": code
        }

class TestQuadraticApi(IsolatedAsyncioTestCase):
    async def test_getCells_2d_array(self):
        cells = await getCells((0, 0), (1, 1), first_row_header=False)
        assert cells.equals(pd.DataFrame([["hello 0", "hello 1"], ["hello 0", "hello 1"]], columns=[0, 1]))

    async def test_getCells_1d_array(self):
        cells = await getCells((0, 0), (0, 1), first_row_header=False)
        assert cells.equals(pd.DataFrame([["hello 0"], ["hello 0"]], columns=[0]))

    async def test_getCells_1d_array_header(self):
        cells = await getCells((0, 0), (0, 1), first_row_header=True)
        assert cells.equals(pd.DataFrame([["hello 0"]], columns=["hello 0"]))

    async def test_pos(self):
        cells = await pos()
        assert cells == (0, 0)

    async def test_rel_cell(self):
        cells = await rel_cell(0, 0)
        assert cells == ('hello', (0, 0))

class TestUtils(TestCase):
    def test_to_quadratic_type(self):
        # number
        assert to_quadratic_type(1) == ("1", "number")
        assert to_quadratic_type(1.1) == ("1.1", "number")
        assert to_quadratic_type(-1) == ("-1", "number")
        assert to_quadratic_type("1") == ("1", "number")
        assert to_quadratic_type("1.1") == ("1.1", "number")
        assert to_quadratic_type("-1") == ("-1", "number")

        # logical
        assert to_quadratic_type(True) == ("True", "logical")
        assert to_quadratic_type(False) == ("False", "logical")
        assert to_quadratic_type("True") == ("True", "logical")
        assert to_quadratic_type("False") == ("False", "logical")
        assert to_quadratic_type("true") == ("True", "logical")
        assert to_quadratic_type("false") == ("False", "logical")

        # string
        assert to_quadratic_type("abc") == ("abc", "text")
        assert to_quadratic_type("123abc") == ("123abc", "text")
        assert to_quadratic_type("abc123") == ("abc123", "text")

        # instant
        assert to_quadratic_type(pd.Timestamp("2012-11-10")) == ("1352505600", "instant")
        assert to_quadratic_type(pd.Timestamp("2012-11-10T03:30")) == ("1352518200", "instant")
        assert to_quadratic_type(np.datetime64("2012-11-10")) == ("1352505600", "instant")
        assert to_quadratic_type(np.datetime64("2012-11-10T03:30")) == ("1352518200", "instant")
        assert to_quadratic_type(datetime.strptime("2012-11-10", '%Y-%m-%d')) == ("1352505600", "instant")
        assert to_quadratic_type(datetime.strptime("2012-11-10 03:30", '%Y-%m-%d %H:%M')) == ("1352518200", "instant")
        # assert to_quadratic_type("2012-11-10") == ("1352505600", "instant")

        # TODO(ddimaria): implement when we implement duration in Rust
        # duration

if __name__ == "__main__":
    unittest.main()

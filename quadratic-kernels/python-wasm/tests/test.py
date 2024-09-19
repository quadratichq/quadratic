import importlib
import inspect
import sys
import unittest
from datetime import date, datetime, time
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import numpy as np
import pandas as pd

from inspect_python_test import *
from process_output_test import *
from quadratic_py.utils import attempt_fix_await, to_python_type, to_quadratic_type


#  Mock definitions
class Cell:
    def __init__(self, x, y, value, type_name):
        self.x = x
        self.y = y
        self.value = value
        self.type_name = type_name


def mock_GetCellsDB(
    x1: int, y1: int, x2: int, y2: int, sheet: str = None, line: int = False
):
    out = []

    for x in range(x1, x2 + 1):
        for y in range(y1, y2 + 1):
            out.append(Cell(x, y, f"hello {x}", "string"))

    return out


class mock_micropip:
    async def install(name):
        return __import__(name)


async def mock_fetch_module(source: str):
    return __import__(source)


# mock modules needed to import run_python
sys.modules["pyodide"] = MagicMock()
sys.modules["pyodide.code"] = MagicMock()
sys.modules["getCellsDB"] = mock_GetCellsDB
sys.modules["micropip"] = AsyncMock()
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.io"] = MagicMock()
sys.modules["autopep8"] = MagicMock()
sys.modules["autopep8.fix_code"] = MagicMock()

# import after mocks to in order to use them
from quadratic_py import code_trace, run_python
from quadratic_py.quadratic_api.quadratic import getCells

run_python.fetch_module = mock_fetch_module


class value_object:
    def __init__(self, x, y, value):
        self.x = x
        self.y = y
        self.value = value


class TestTesting(IsolatedAsyncioTestCase):
    async def test_run_python(self):

        result = await run_python.run_python("1 + 1", (0, 0, "Sheet 1"))

        # NOTE: this approach bypasses the entire env of Pyodide.
        # We should make the run_python e2e tests run via playwright
        self.assertEqual(result.get("success"), False)

    def test_attempt_fix_await(self):
        self.assertEqual(attempt_fix_await("1 + 1"), "1 + 1")

        # simple without await
        self.assertEqual(attempt_fix_await("a = cells(0, 0)"), "a = cells(0, 0)")
        self.assertEqual(attempt_fix_await("a = cell(0, 0)"), "a = cell(0, 0)")
        self.assertEqual(attempt_fix_await("a = c(0, 0)"), "a = c(0, 0)")
        self.assertEqual(attempt_fix_await("a = rel_cell(0, 0)"), "a = rel_cell(0, 0)")
        self.assertEqual(attempt_fix_await("a = rc(0, 0)"), "a = rc(0, 0)")
        self.assertEqual(attempt_fix_await("a = getCells(0, 0)"), "a = getCells(0, 0)")

        # simple already has await
        self.assertEqual(attempt_fix_await("a = await cells(0, 0)"), "a = cells(0, 0)")
        self.assertEqual(attempt_fix_await("a = await cell(0, 0)"), "a = cell(0, 0)")
        self.assertEqual(attempt_fix_await("a = await c(0, 0)"), "a = c(0, 0)")
        self.assertEqual(
            attempt_fix_await("a = await rel_cell(0, 0)"), "a = rel_cell(0, 0)"
        )
        self.assertEqual(attempt_fix_await("a = await rc(0, 0)"), "a = rc(0, 0)")
        self.assertEqual(
            attempt_fix_await("a = await getCells(0, 0)"), "a = getCells(0, 0)"
        )

        # other
        self.assertEqual(attempt_fix_await("a = cac(0, 0)"), "a = cac(0, 0)")
        self.assertEqual(attempt_fix_await("c(0, 0)"), "c(0, 0)")
        self.assertEqual(attempt_fix_await("int(c(0,0))"), "int(c(0,0))")
        self.assertEqual(attempt_fix_await("int(await c(0,0))"), "int(c(0,0))")
        self.assertEqual(
            attempt_fix_await("float(c(2, -4).value)"), "float(c(2, -4).value)"
        )
        self.assertEqual(
            attempt_fix_await("float((await c(2, -4)).value)"),
            "float((c(2, -4)).value)",
        )
        self.assertEqual(
            attempt_fix_await("cells((0,0), (0,10)).sum()"),
            "cells((0,0), (0,10)).sum()",
        )
        self.assertEqual(attempt_fix_await("c(0, 0)\nc(0, 0)"), "c(0, 0)\nc(0, 0)")

        # convert c((x,y), ...) cell((x,y), ...) to cells((x,y), ...)
        self.assertEqual(
            attempt_fix_await("await c((0,0), (0,10), (10,10), (10,0)).sum()"),
            "cells((0,0), (0,10), (10,10), (10,0)).sum()",
        )
        self.assertEqual(
            attempt_fix_await("await c((0,0), (0,10), (10,10), (10,0)).sum()"),
            "cells((0,0), (0,10), (10,10), (10,0)).sum()",
        )
        self.assertEqual(
            attempt_fix_await("await cell((0,0), (0,10), (10,10), (10,0)).sum()"),
            "cells((0,0), (0,10), (10,10), (10,0)).sum()",
        )
        self.assertEqual(
            attempt_fix_await("await cells((0,0), (0,10), (10,10), (10,0)).sum()"),
            "cells((0,0), (0,10), (10,10), (10,0)).sum()",
        )
        self.assertEqual(
            attempt_fix_await("await gc((0,0), (0,10), (10,10), (10,0)).sum()"),
            "await gc((0,0), (0,10), (10,10), (10,0)).sum()",
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
                function="fake_plotly_func",
            ),
            user_frame_2,
            user_frame_1,
            Mock(
                filename="/lib/pythonSomeVersionZip/_pyodide/_base.py",
                lineno=444,
                function="run_async",
            ),
            Mock(
                filename="/lib/pythonSomeVersionZip/_pyodide/_base.py",
                lineno=333,
                function="eval_code_async",
            ),
            Mock(filename="<exec>", lineno=222, function="run_python"),
            Mock(
                filename="/lib/pythonSomeVersionZip/pyodide/webloop.py",
                lineno=111,
                function="run_handle",
            ),
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
        sout = Mock(getvalue=Mock())
        line_number = 42

        assert run_python.error_result(err, code, sout, line_number) == {
            "std_out": sout.getvalue.return_value,
            "success": False,
            "input_python_stack_trace": "RuntimeError on line 42: Test message",
            "line_number": 42,
            "formatted_code": code,
        }


class TestQuadraticApi(IsolatedAsyncioTestCase):
    def test_getCells_2d_array(self):
        cells = getCells((0, 0), (1, 1), first_row_header=False)
        assert cells.equals(
            pd.DataFrame(
                [["hello 0", "hello 1"], ["hello 0", "hello 1"]], columns=[0, 1]
            )
        )

    def test_getCells_1d_array(self):
        cells = getCells((0, 0), (0, 1), first_row_header=False)
        assert cells.equals(pd.DataFrame([["hello 0"], ["hello 0"]], columns=[0]))

    def test_getCells_1d_array_header(self):
        cells = getCells((0, 0), (0, 1), first_row_header=True)
        assert cells.equals(pd.DataFrame([["hello 0"]], columns=["hello 0"]))


class TestPos(IsolatedAsyncioTestCase):
    async def test_pos(self):
        result = await run_python.run_python("pos()", (0, 0, "Sheet 1"))
        self.assertEqual(result.get("success"), False)


class TestUtils(TestCase):
    def test_to_quadratic_type(self):
        # number
        assert to_quadratic_type(1) == ("1", "number")
        assert to_quadratic_type(1.1) == ("1.1", "number")
        assert to_quadratic_type(-1) == ("-1", "number")
        assert to_quadratic_type(np.float64("1.1")) == ("1.1", "number")

        # logical
        assert to_quadratic_type(True) == ("True", "logical")
        assert to_quadratic_type(False) == ("False", "logical")

        # string
        assert to_quadratic_type("abc") == ("abc", "text")
        assert to_quadratic_type("123abc") == ("123abc", "text")
        assert to_quadratic_type("abc123") == ("abc123", "text")
        assert to_quadratic_type("1") == ("1", "text")
        assert to_quadratic_type("1.1") == ("1.1", "text")
        assert to_quadratic_type("-1") == ("-1", "text")
        assert to_quadratic_type("True") == ("True", "text")
        assert to_quadratic_type("False") == ("False", "text")
        assert to_quadratic_type("true") == ("true", "text")
        assert to_quadratic_type("false") == ("false", "text")

        # dates
        assert to_quadratic_type(pd.Timestamp("2012-11-10")) == (
            "2012-11-10T00:00:00",
            "date time",
        )
        assert to_quadratic_type(pd.Timestamp("2012-11-10T03:30")) == (
            "2012-11-10T03:30:00",
            "date time",
        )
        assert to_quadratic_type(np.datetime64("2012-11-10")) == (
            "2012-11-10T00:00:00",
            "date time",
        )
        assert to_quadratic_type(np.datetime64("2012-11-10T03:30")) == (
            "2012-11-10T03:30:00",
            "date time",
        )
        assert to_quadratic_type(datetime.strptime("2012-11-10", "%Y-%m-%d")) == (
            "2012-11-10T00:00:00",
            "date time",
        )
        assert to_quadratic_type(
            datetime.strptime("2012-11-10 03:30", "%Y-%m-%d %H:%M")
        ) == ("2012-11-10T03:30:00", "date time")
        # assert to_quadratic_type("2012-11-10") == ("1352505600", "instant")

        assert to_quadratic_type(date(2012, 12, 21)) == ("2012-12-21", "date")
        assert to_quadratic_type(time(3, 30)) == ("03:30:00", "time")

        # TODO(ddimaria): implement when we implement duration in Rust
        # duration

    def test_to_python_type(self):
        # blank
        assert to_python_type("", "blank") is None

        # number
        assert to_python_type("1", "number") == 1
        assert to_python_type("1.1", "number") == 1.1
        assert to_python_type("-1", "number") == -1
        assert to_python_type("-1.1", "number") == -1.1

        # logical
        assert to_python_type("True", "logical") == True
        assert to_python_type("False", "logical") == False
        assert to_python_type("true", "logical") == True
        assert to_python_type("false", "logical") == False

        # string
        assert to_python_type("abc", "text") == "abc"
        assert to_python_type("123abc", "text") == "123abc"
        assert to_python_type("abc123", "text") == "abc123"

        # date
        assert to_python_type("2012-11-10T00:00:00", "date") == datetime(2012, 11, 10)
        assert to_python_type("2012-11-10T03:30:00", "date") == datetime(
            2012, 11, 10, 3, 30
        )


if __name__ == "__main__":
    unittest.main()

import importlib
import inspect
import re
import sys
import unittest
from datetime import date, datetime, time
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import numpy as np
import pandas as pd

from inspect_python_test import *
from process_output_test import *
from quadratic_py.utils import attempt_fix_await, to_python_type, to_quadratic_type, CellValueType

def a1_to_xy(a1: str) -> tuple:
    # Regular expression to split letters and numbers
    match = re.match(r"([A-Z]+)(\d+)", a1)
    if not match:
        raise ValueError("Invalid A1 notation")

    column_letters, row_part = match.groups()

    # Convert column letters to a number (base-26, A=1, B=2, ..., AA=27, etc.)
    x = 0
    for char in column_letters:
        x = x * 26 + (ord(char) - ord('A') + 1)
    x -= 1  # Convert to 0-based index

    # Convert row to integer and make it 0-based
    y = int(row_part) - 1

    return (x, y)

#  Mock definitions
class Cell:
    def __init__(self, x, y, value, type_u8):
        self.x = x
        self.y = y
        self.v = value
        self.t = type_u8

class Values:
    def __init__(self, w, h, x, y, cells, has_headers):
        self.w = w
        self.h = h
        self.x = x
        self.y = y
        self.cells = cells
        self.has_headers = has_headers

class Result:
    def __init__(self, values: Values, error: str):
        self.values = values
        self.error = error

def mock_getCellsA1(a1: str, first_row_header: bool = False):
    out = []
    parts = a1.split(":")
    x1, y1 = a1_to_xy(parts[0])

    if len(parts) == 1:
        x2 = x1 + 1
        y2 = y1 + 1
    else:
        x2, y2 = a1_to_xy(parts[1])

    for x in range(x1, x2 + 1):
        for y in range(y1, y2 + 1):
            out.append(Cell(x, y, f"hello {x}", "string"))

    values = Values(x2 - x1 + 1, y2 - y1 + 1, x1, y1, out, first_row_header)

    return Result(values, None)

class mock_micropip:
    async def install(name):
        return __import__(name)


async def mock_fetch_module(source: str):
    return __import__(source)


# mock modules needed to import run_python
sys.modules["pyodide"] = MagicMock()
sys.modules["pyodide.code"] = MagicMock()
sys.modules["getCellsA1"] = mock_getCellsA1
sys.modules["getStockPrices"] = MagicMock()
sys.modules["micropip"] = AsyncMock()
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.io"] = MagicMock()
sys.modules["autopep8"] = MagicMock()
sys.modules["autopep8.fix_code"] = MagicMock()

# import after mocks to in order to use them
from quadratic_py import code_trace, run_python
# from quadratic_py.quadratic_api.quadratic import getCells
from quadratic_py.quadratic_api.quadratic import q

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


class TestQuadraticApi(TestCase):
    def test_getCells_2d_array(self):
        q_new = q((0, 0))
        cells = q_new.cells("A1:B2", first_row_header=False)
        assert cells.equals(
            pd.DataFrame(
                [["hello 0", "hello 1"], ["hello 0", "hello 1"]], columns=[0, 1]
            )
        )

    def test_getCells_1d_array(self):
        q_new = q((0, 0))
        cells = q_new.cells("A1:A2", first_row_header=False)
        print("CELLS", cells, )
        assert cells.equals(pd.DataFrame([["hello 0"], ["hello 0"]], columns=[0]))

    def test_getCells_1d_array_header(self):
        q_new = q((0, 0))
        cells = q_new.cells("A1:A2", first_row_header=True)
        assert cells.equals(pd.DataFrame([["hello 0"]], columns=["hello 0"]))


class TestPos(IsolatedAsyncioTestCase):
    async def test_pos(self):
        result = await run_python.run_python("pos()", (0, 0, "Sheet 1"))
        self.assertEqual(result.get("success"), False)


class TestUtils(TestCase):
    def test_to_quadratic_type(self):
        # number
        assert to_quadratic_type(1) == ("1", CellValueType.Number.value)
        assert to_quadratic_type(1.1) == ("1.1", CellValueType.Number.value)
        assert to_quadratic_type(-1) == ("-1", CellValueType.Number.value)
        assert to_quadratic_type(np.float64("1.1")) == ("1.1", CellValueType.Number.value)

        # logical
        assert to_quadratic_type(True) == ("True", CellValueType.Logical.value)
        assert to_quadratic_type(False) == ("False", CellValueType.Logical.value)

        # string
        assert to_quadratic_type("abc") == ("abc", CellValueType.Text.value)
        assert to_quadratic_type("123abc") == ("123abc", CellValueType.Text.value)
        assert to_quadratic_type("abc123") == ("abc123", CellValueType.Text.value)
        assert to_quadratic_type("1") == ("1", CellValueType.Text.value)
        assert to_quadratic_type("1.1") == ("1.1", CellValueType.Text.value)
        assert to_quadratic_type("-1") == ("-1", CellValueType.Text.value)
        assert to_quadratic_type("True") == ("True", CellValueType.Text.value)
        assert to_quadratic_type("False") == ("False", CellValueType.Text.value)
        assert to_quadratic_type("true") == ("true", CellValueType.Text.value)
        assert to_quadratic_type("false") == ("false", CellValueType.Text.value)

        # date time
        assert to_quadratic_type(pd.Timestamp("2012-11-10")) == (
            "2012-11-10T00:00:00",
            CellValueType.DateTime.value,
        )
        assert to_quadratic_type(pd.Timestamp("2012-11-10T03:30")) == (
            "2012-11-10T03:30:00",
            CellValueType.DateTime.value,
        )
        assert to_quadratic_type(np.datetime64("2012-11-10")) == (
            "2012-11-10T00:00:00",
            CellValueType.DateTime.value,
        )
        assert to_quadratic_type(np.datetime64("2012-11-10T03:30")) == (
            "2012-11-10T03:30:00",
            CellValueType.DateTime.value,
        )
        assert to_quadratic_type(datetime.strptime("2012-11-10", "%Y-%m-%d")) == (
            "2012-11-10T00:00:00",
            CellValueType.DateTime.value,
        )
        assert to_quadratic_type(
            datetime.strptime("2012-11-10 03:30", "%Y-%m-%d %H:%M")
        ) == ("2012-11-10T03:30:00", CellValueType.DateTime.value)

        # date
        assert to_quadratic_type(date(2012, 12, 21)) == ("2012-12-21", CellValueType.Date.value)

        # time
        assert to_quadratic_type(time(3, 30)) == ("03:30:00", CellValueType.Time.value)

        # duration
        assert to_quadratic_type(relativedelta(
            years=1,
            months=2,
            weeks=3,
            days=4,
            hours=5,
            minutes=6,
            seconds=7.5,
            microseconds=155,
        )) == ("1y 2mo 25d 5h 6m 7.5s 155µs", CellValueType.Duration.value)

    def test_to_python_type(self):
        # blank
        assert to_python_type("", CellValueType.Blank.value) is None

        # number
        assert to_python_type("1", CellValueType.Number.value) == 1
        assert to_python_type("1.1", CellValueType.Number.value) == 1.1
        assert to_python_type("-1", CellValueType.Number.value) == -1
        assert to_python_type("-1.1", CellValueType.Number.value) == -1.1

        # logical
        assert to_python_type("True", CellValueType.Logical.value) == True
        assert to_python_type("False", CellValueType.Logical.value) == False
        assert to_python_type("true", CellValueType.Logical.value) == True
        assert to_python_type("false", CellValueType.Logical.value) == False

        # string
        assert to_python_type("abc", CellValueType.Text.value) == "abc"
        assert to_python_type("123abc", CellValueType.Text.value) == "123abc"
        assert to_python_type("abc123", CellValueType.Text.value) == "abc123"

        # date
        assert to_python_type("2012-11-10T00:00:00", CellValueType.Date.value) == datetime(2012, 11, 10).date()
        assert to_python_type("2012-11-10T03:30:00", CellValueType.Date.value) == datetime(
            2012, 11, 10, 3, 30
        ).date()

        # date time
        assert to_python_type("2012-11-10T00:00:00", CellValueType.DateTime.value) == datetime(2012, 11, 10)
        assert to_python_type("2012-11-10T03:30:00", CellValueType.DateTime.value) == datetime(
            2012, 11, 10, 3, 30
        )

        # duration
        assert to_python_type("1y 2mo 3w 4d 5h 6m 7.5s 3ms 4µs", CellValueType.Duration.value) == relativedelta(
            years=1,
            months=2,
            days=25, # no weeks!
            hours=5,
            minutes=6,
            seconds=7.5,
            microseconds=3004,
        )
        assert to_python_type("1µs 2ns 3ps 4fs 5as", CellValueType.Duration.value) == relativedelta(
            microseconds=1.002003004005,
        )


if __name__ == "__main__":
    unittest.main()

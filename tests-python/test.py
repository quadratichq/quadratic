import inspect
import sys
import unittest
from pprint import pprint
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import Mock, patch


#  Mock definitions
def mock_GetCellsDB():
    return []


class mock_pyodide:
    async def eval_code_async(code, globals):
        return exec(code, globals=globals)


class mock_micropip:
    def install(name):
        return None

# mock modules needed to import run_python
sys.modules["getCellsDB"] = mock_GetCellsDB
sys.modules["pyodide"] = mock_pyodide
sys.modules["micropip"] = mock_micropip

# add path to import run_python
sys.path.insert(1, "public")

from run_python import (Cell, attempt_fix_await, ensure_not_cell, not_cell,
                        run_python, _get_user_frames, _error_result, _get_return_line)


class value_object:
    def __init__(self, x, y, value):
        self.x = x
        self.y = y
        self.value = value

class TestTesting(IsolatedAsyncioTestCase):
    async def test_run_python(self):

        result = await run_python("1 + 1")

        # NOTE: this approach bypasses the entire env of Pyodide.
        # We should make the run_python e2e tests run via playwright
        self.assertEqual(result.get("success"), False)

    def test_attempt_fix_await(self):
        self.assertEqual(attempt_fix_await("1 + 1"), "1 + 1")

        # simple adding await
        self.assertEqual(attempt_fix_await("a = cells(0, 0)"), "a = await cells(0, 0)")
        self.assertEqual(attempt_fix_await("a = cell(0, 0)"), "a = await cell(0, 0)")
        self.assertEqual(attempt_fix_await("a = c(0, 0)"), "a = await c(0, 0)")
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

    def test_not_cell(self):
        o = value_object(0, 0, "test")
        c = Cell(o)
        self.assertEqual(not_cell(c), "test")

        l = [Cell(o), Cell(o), Cell(o)]
        self.assertEqual(ensure_not_cell(l), ["test", "test", "test"])


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
            actual_user_frames = _get_user_frames()
            assert actual_user_frames == expected_user_frames

    def test_get_return_line(self):
        example_code = r"""import itertools
        
        print("Counting to 0\n\n\n")
        next(itertools.count())
        
        
        """

        assert _get_return_line(example_code) == 4

    def test_error_result(self):
        err = RuntimeError("Test message")
        code = Mock()
        cells_accessed = Mock()
        sout = Mock(getvalue=Mock())
        line_number = 42

        assert _error_result(err, code, cells_accessed, sout, line_number) == {
            "output_value": None,
            "array_output": None,
            "cells_accessed": cells_accessed,
            "std_out": sout.getvalue.return_value,
            "success": False,
            "input_python_stack_trace": "RuntimeError on line 42: Test message",
            "line_number": 42,
            "formatted_code": code
        }


if __name__ == "__main__":
    unittest.main()

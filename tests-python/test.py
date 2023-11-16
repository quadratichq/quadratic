import sys
import unittest
from pprint import pprint
from unittest import IsolatedAsyncioTestCase


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
sys.path.insert(1, "src/web-workers/pythonWebWorker")

from run_python import (Cell, attempt_fix_await, ensure_not_cell, not_cell,
                        run_python)


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

if __name__ == "__main__":
    unittest.main()

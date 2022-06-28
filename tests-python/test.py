import sys
import unittest
from unittest import IsolatedAsyncioTestCase
from pprint import pprint


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
sys.modules["GetCellsDB"] = mock_GetCellsDB
sys.modules["pyodide"] = mock_pyodide
sys.modules["micropip"] = mock_micropip

# add path to import run_python
sys.path.insert(1, "src/core/computations/python")

from run_python import run_python, attempt_fix_await


class TestTesting(IsolatedAsyncioTestCase):
    async def test_run_python(self):

        result = await run_python("1 + 1")

        # NOTE: this approach bypasses the entire env of Pyodide.
        # We should make the run_python e2e tests run via playwright
        self.assertEqual(result.get("input_python_evaluation_success"), False)

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


if __name__ == "__main__":
    unittest.main()

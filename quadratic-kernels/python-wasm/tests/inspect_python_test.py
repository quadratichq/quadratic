import sys
from unittest import IsolatedAsyncioTestCase
from unittest.mock import MagicMock, patch

async def CodeRunner(code: str):
    print("HERE******")
    return True

# mock modules needed to import inspect_python
mock = MagicMock()
mock.code= MagicMock()
mock.code.CodeRunner = CodeRunner
sys.modules["pyodide"] = mock

import pandas as pd
from quadratic_py.inspect_python import inspect_python


class TestInspectPython(IsolatedAsyncioTestCase):
    # this is just a stub and doesn't do anything, but a start to testing inspect_python
    async def test_inspect_python(self):
        code = "a = cells(0, 0)"
        result = await inspect_python(code)
        self.assertEqual(result, None)
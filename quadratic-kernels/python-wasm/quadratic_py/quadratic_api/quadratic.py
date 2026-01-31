from typing import Tuple

import getCellsA1
import getStockPrices
from pandas import DataFrame

from ..utils import result_to_value, to_python_type_df

results = None


class Financial:
    """Financial data module for accessing stock prices and other financial data."""

    async def stock_prices(self, identifier: str, start_date: str = None, end_date: str = None, frequency: str = None) -> dict:
        """
        Get historical stock prices for a security.

        Args:
            identifier: Stock ticker symbol (e.g., "AAPL")
            start_date: Optional start date in YYYY-MM-DD format
            end_date: Optional end date in YYYY-MM-DD format
            frequency: Optional frequency for price data ("daily", "weekly", "monthly", "quarterly", "yearly"). Defaults to "daily".

        Returns:
            Dictionary containing stock price data

        Typical usage example:
            prices = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-01-31")
            weekly_prices = await q.financial.stock_prices("AAPL", "2025-01-01", "2025-01-31", "weekly")
        """
        # getStockPrices is a JS async function, await the promise
        result = await getStockPrices(identifier, start_date, end_date, frequency)

        # Convert JsProxy to Python dict if needed
        if hasattr(result, 'to_py'):
            result = result.to_py()

        # Check for errors
        error = result.get('error') if isinstance(result, dict) else getattr(result, 'error', None)
        if error:
            raise Exception(error)

        data = result.get('data') if isinstance(result, dict) else getattr(result, 'data', None)
        return data


# Code in this file is used to generate typeshed stubs for Pyright (Python LSP)
#
# All functions variations are intentionally included.


def getCell(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1 = q.to_a1(p_x, p_y, absolute=False)
    old = f"getCell({p_x}, {p_y})"
    new = f'q.cells("{a1}")'
    q._conversion_error(old, new)


def cell(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1 = q.to_a1(p_x, p_y, absolute=False)
    old = f"cell({p_x}, {p_y})"
    new = f'q.cells("{a1}")'
    q._conversion_error(old, new)


def c(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """
    a1 = q.to_a1(p_x, p_y, absolute=False)
    old = f"c({p_x}, {p_y})"
    new = f'q.cells("{a1}")'
    q._conversion_error(old, new)
    # return getCell(p_x, p_y, sheet)


def getCells(
    p0: Tuple[int, int],
    p1: Tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> DataFrame:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1_0 = q.to_a1(p0[0], p0[1], absolute=False)
    a1_1 = q.to_a1(p1[0], p1[1], absolute=False)
    old = f"cells({p0[0]},{ p0[1]}, {p1[0]}, {p1[1]})"
    new = f'q.cells("{a1_0}:{a1_1}")'
    q._conversion_error(old, new)


def cells(
    p0: Tuple[int, int],
    p1: Tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> DataFrame:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1_0 = q.to_a1(p0[0], p0[1], absolute=False)
    a1_1 = q.to_a1(p1[0], p1[1], absolute=False)
    old = f"cells({p0[0]},{ p0[1]}, {p1[0]}, {p1[1]})"
    new = f'q.cells("{a1_0}:{a1_1}")'
    q._conversion_error(old, new)


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rel_cell(x: int, y: int) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    old = f"rel_cell({x}, {y})"
    a1 = q.to_a1(x, y, absolute=False)
    new = f'q.cells("{a1}")'
    q._conversion_error(old, new)


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rel_cells(
    first: tuple[int, int],
    second: tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1_0 = q.to_a1(first[0], first[1], absolute=False)
    a1_1 = q.to_a1(second[0], second[1], absolute=False)
    old = f"rel_cells({first[0]},{ first[1]}, {second[0]}, {second[1]})"
    new = f'q.cells("{a1_0}:{a1_1}")'
    q._conversion_error(old, new)


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rc(x: int, y: int) -> int | float | str | bool | None:
    """
    THIS FUNCTION IS NO LONGER USED. USE q.cells() INSTEAD.
    """

    a1 = q.to_a1(x, y, absolute=False)
    old = f"rc({x}, {y})"
    new = f'q.cells("{a1}")'
    q._conversion_error(old, new)


class q:
    def __init__(self, pos):
        self._pos = pos
        self._financial = Financial()

    @property
    def financial(self) -> Financial:
        """Access financial data functions."""
        return self._financial

    def cells(self, a1: str, first_row_header: bool = False):
        """
        Reference cells in the grid.

        Args:
            a1: A string representing a cell or range of cells.
            first_row_header: If True the first row will be used as the header.

        Returns:
            For single returns: the value of the cell referenced. For multiple returns: A pandas DataFrame of the cells referenced.

        Typical usage example:
            c = q.cells("A1:B5")
        """
        response = getCellsA1(a1)

        if response.error != None:
            raise Exception(response.error.core_error)

        result = response.values

        if result == None:
            return None

        if result.w == 1 and result.h == 1:
            return result_to_value(result.cells[0])
        
        data = [[None] * result.w for _ in range(result.h)]
        for cell in result.cells:
            row = cell.y - result.y
            col = cell.x - result.x
            data[row][col] = to_python_type_df(cell.v, cell.t)

        # Create DataFrame from 2D array
        df = DataFrame(data)

        # Move the first row to the header
        if first_row_header or result.has_headers:
            # Convert first row to strings to ensure they work as column names
            headers = [str(val) for val in df.iloc[0]]
            df.columns = headers
            df = df.iloc[1:].reset_index(drop=True)

        return df

    def pos(self) -> tuple[int, int]:
        """
        A relative reference to the current cell in the grid.

        Returns:
            The tuple (x, y) coordinates of the current cell.

        Typical usage example:
            (x, y) = pos()
        """

        return self._pos

    def to_a1(x: int, y: int, absolute: bool = True) -> str:
        """
        Convert (x, y) coordinates to A1 notation.
        x: Column number (1-based index)
        y: Row number (1-based index)
        Returns: A1 notation as a string
        """

        column = ""

        while x > 0:
            x -= 1
            column = chr(x % 26 + 65) + column
            x //= 26

        if absolute:
            column = f"${column}"
            y = f"${y}"

        return f"{column}{y}"

    def _conversion_error(old: str, new: str, raise_exception: bool = True):
        url = "https://community.quadratichq.com/t/switch-to-a1-notation-from-x-y-coordinates/"
        output = f"{old} functionality is no longer supported.  Use {new} instead, though this may be different if your sheet had negative values.  Refer to the documentation at {url} for more details."

        if raise_exception:
            raise Exception(output)
        else:
            print(output)


# Instance declaration for type stubs - actual instance created in run_python.py
q: q

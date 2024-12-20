from typing import Tuple

import getCellsA1

from pandas import DataFrame, Series

from ..utils import result_to_value, stack_line_number, to_python_type_df

results = None

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
    q.conversion_error(old, new)


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
        result = getCellsA1(a1, int(stack_line_number()))

        if result.w == 1 and result.h == 1:
            return result_to_value(result.cells[0])

        # Create empty df of the correct size
        df = DataFrame(
            index=range(result.h),
            columns=range(result.w),
        )

        # Fill DF
        x_offset = result.x
        y_offset = result.y

        for cell in result.cells:
            value = to_python_type_df(cell.value, cell.type_name)
            df.at[cell.y - y_offset, cell.x - x_offset] = value

        # Move the first row to the header
        if first_row_header:
            df.rename(columns=df.iloc[0], inplace=True)
            df.drop(df.index[0], inplace=True)
            df.reset_index(drop=True, inplace=True)

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
        output = f"{old} functionality is no longer supported.  Use {new} instead, though this may be different if your sheet had negative values.  Refer to the documentation at https://docs.quadratic.app/python-api/ for more details."

        if raise_exception:
            raise Exception(output)
        else:
            print(output)

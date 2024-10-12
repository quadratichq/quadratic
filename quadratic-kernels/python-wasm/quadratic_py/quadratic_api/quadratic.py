from typing import Tuple

import getCellsDB
import getCellsA1

from pandas import DataFrame, Series

from ..utils import result_to_value, stack_line_number, to_python_type_df

results = None

# Code in this file is used to generate typeshed stubs for Pyright (Python LSP)
#
# All functions variations are intentionally included.


def getCell(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.

    Args:
        p_x: The X coordinate on the grid.
        p_y: The Y coordinate on the grid.
        sheet: The name of the sheet to reference. Defaults to the current sheet.

    Returns:
        The value of the cell referenced.

    Typical usage example:
        c = getCell(0, 0)
    """

    result = getCellsDB(p_x, p_y, p_x, p_y, sheet, int(stack_line_number()))

    if len(result):
        return result_to_value(result[0])
    else:
        return None


def cell(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.

    Args:
        p_x: The X coordinate on the grid.
        p_y: The Y coordinate on the grid.
        sheet: The name of the sheet to reference. Defaults to the current sheet.

    Returns:
        The value of the cell referenced.

    Typical usage example:
        c = cell(0, 0)
    """

    return getCell(p_x, p_y, sheet)


def c(p_x: int, p_y: int, sheet: str = None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.

    Args:
        p_x: The X coordinate on the grid.
        p_y: The Y coordinate on the grid.
        sheet: The name of the sheet to reference. Defaults to the current sheet.

    Returns:
        The value of the cell referenced.

    Typical usage example:
        c = c(0, 0)
    """

    return getCell(p_x, p_y, sheet)


def q(a1: str, first_row_header: bool = False) -> DataFrame | int | float | str | bool | None:
    """
    Reference cells in the grid.

    Args:
        a1: A string representing a cell or range of cells.
        first_row_header: If True the first row will be used as the header.

    Returns:
        For single returns: the value of the cell referenced. For multiple returns: A pandas DataFrame of the cells referenced.

    Typical usage example:
        c = q("A1:B5")
    """
    result = getCellsA1(a1, int(stack_line_number()))
    print(result.x)
    return None

def getCells(
    p0: Tuple[int, int],
    p1: Tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> DataFrame:
    """
    Reference multiple cells in the grid.

    Args:
        p0: A tuple of (x, y) coordinates on the grid.
        p1: A tuple of (x, y) coordinates on the grid
        sheet: The name of the sheet to reference. Defaults to the current sheet.
        first_row_header: If True the first row will be used as the header.

    Returns:
        A pandas DataFrame of the cells referenced.

    Typical usage example:
        c = getCells((0, 0), (1, 1))
    """

    # Get Cells
    cells = getCellsDB(p0[0], p0[1], p1[0], p1[1], sheet, int(stack_line_number()))
    cell_range_width = p1[0] - p0[0] + 1
    cell_range_height = p1[1] - p0[1] + 1

    # TODO(ddimaria): consider removing after team decides this is the right approach
    # for always returning a dataframe.
    #
    # return a panda series for a 1d vertical array of cells
    # if cell_range_width == 1:
    #     cell_list = [result_to_value(cell) for cell in cells]
    #     return Series(cell_list)

    # Create empty df of the correct size
    df = DataFrame(
        index=range(cell_range_height),
        columns=range(cell_range_width),
    )

    # Fill DF
    x_offset = p0[0]
    y_offset = p0[1]

    for cell in cells:
        value = to_python_type_df(cell.value, cell.type_name)
        df.at[cell.y - y_offset, cell.x - x_offset] = value

    # Move the first row to the header
    if first_row_header:
        df.rename(columns=df.iloc[0], inplace=True)
        df.drop(df.index[0], inplace=True)
        df.reset_index(drop=True, inplace=True)

    return df


def cells(
    p0: Tuple[int, int],
    p1: Tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> DataFrame:
    """
    Reference multiple cells in the grid.

    Args:
        p0: A tuple of (x, y) coordinates on the grid.
        p1: A tuple of (x, y) coordinates on the grid
        sheet: The name of the sheet to reference. Defaults to the current sheet.
        first_row_header: If True the first row will be used as the header.

    Returns:
        A pandas DataFrame of the cells referenced.

    Typical usage example:
        c = cells((0, 0), (1, 1))
    """

    return getCells(p0, p1, sheet, first_row_header)


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def pos() -> tuple[int, int]:
    """
    A relative reference to the current cell in the grid.

    Returns:
        The tuple (x, y) coordinates of the current cell.

    Typical usage example:
        (x, y) = pos()
    """

    return None


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rel_cell(x: int, y: int) -> int | float | str | bool | None:
    """
    Relative reference to a single cell in the grid.

    Args:
        x: The relative grid X coordinate from the current cell.
        y: The relative grid Y coordinate from the current cell.

    Returns:
        The value of the relative cell referenced.

    Typical usage example:
        c = rel_cell(-1, 0) # references the cell to the left of this cell
    """

    return None


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rel_cells(
    first: tuple[int, int],
    second: tuple[int, int],
    sheet: str = None,
    first_row_header: bool = False,
) -> int | float | str | bool | None:
    """
    Relative reference to a single cell in the grid.

    Args:
        first: The relative grid coordinate tuple from the current cell.
        second: The relative grid coordinate tuple from the current cell.
        sheet: The name of the sheet to reference. Defaults to the current sheet.
        first_row_header: If True the first row will be used as the header.

    Returns:
        The value of the relative cell referenced.

    Typical usage example:
        c = rel_cells((-5, -5), (-3, -2)) # references the cells starting -5 cells left, and -5 cells up from the code cell
    """

    return None


# This function is not used from here (it's a lambda function in run_python.py)
# This is documented for pyright usage only
def rc(x: int, y: int) -> int | float | str | bool | None:
    """
    Relative reference to a single cell in the grid.

    Args:
        x: The relative grid X coordinate from the current cell.
        y: The relative grid Y coordinate from the current cell.

    Returns:
        The value of the relative cell referenced.

    Typical usage example:
        c = rel_cell(-1, 0) # references the cell to the left of this cell
    """

    return None

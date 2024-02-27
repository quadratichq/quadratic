from typing import Tuple

from ..utils import result_to_value, to_python_type, stack_line_number
import getCellsDB
import pandas as pd

# Code in this file is used to generate typeshed stubs for Pyright (Python LSP)
#
# All functions variations are intentionally included.

async def getCell(p_x: int, p_y: int, sheet: str=None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.
    """

    result = await getCellsDB(p_x, p_y, p_x, p_y, sheet, int(stack_line_number()))

    if len(result):
        return result_to_value(result[0])
    else:
        return None

async def cell(p_x: int, p_y: int, sheet: str=None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.
    """

    return await getCell(p_x, p_y, sheet)

async def c(p_x: int, p_y: int, sheet: str=None) -> int | float | str | bool | None:
    """
    Reference a single cell in the grid.
    """

    return await getCell(p_x, p_y, sheet)

async def getCells(p0: Tuple[int, int], p1: Tuple[int, int], sheet: str=None, first_row_header: bool=False) -> pd.DataFrame:
    """
    Reference multiple cells in the grid.
    """

    # Get Cells
    cells = await getCellsDB(p0[0], p0[1], p1[0], p1[1], sheet, int(stack_line_number()))

    cell_range_width = p1[0] - p0[0] + 1
    cell_range_height = p1[1] - p0[1] + 1

    # return a panda series for a 1d vertical array of cells     
    if cell_range_width == 1:
        cell_list = [result_to_value(cell) for cell in cells]        
        return pd.Series(cell_list)

    # Create empty df of the correct size
    df = pd.DataFrame(  
        index=range(cell_range_height),
        columns=range(cell_range_width),
    )

    # Fill DF
    x_offset = p0[0]
    y_offset = p0[1]

    for cell in cells:
        value = to_python_type(cell.value, cell.type_name)
        df.at[cell.y - y_offset, cell.x - x_offset] = value

    # Move the first row to the header
    if first_row_header:
        df.rename(columns=df.iloc[0], inplace=True)
        df.drop(df.index[0], inplace=True)
        df.reset_index(drop=True, inplace=True)

    return df

async def cells(p0: Tuple[int, int], p1: Tuple[int, int], sheet: str=None, first_row_header: bool=False) -> pd.DataFrame:
    """
    Reference multiple cells in the grid.
    """

    return await getCells(p0, p1, sheet, first_row_header)


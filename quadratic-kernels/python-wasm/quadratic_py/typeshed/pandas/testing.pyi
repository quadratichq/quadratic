from typing import Optional

from .core.frame import DataFrame
from .core.series import Series
from .core.indexes import Index

def assert_frame_equal(
    left: DataFrame,
    right: DataFrame,
    check_like: Optional[bool] = ...,
    check_exact: Optional[bool] = ...,
    check_dtype: bool = ...,
) -> None: ...
def assert_index_equal(left: Index, right: Index) -> None: ...
def assert_series_equal(
    left: Series, right: Series, check_names: bool = ..., check_dtype: bool = ...
) -> None: ...

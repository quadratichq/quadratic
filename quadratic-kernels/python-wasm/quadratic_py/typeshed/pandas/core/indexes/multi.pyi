from typing import Iterable, List, Optional, Sequence, Tuple, TypeVar, Union

import numpy as _np

from ..frame import DataFrame
from ..series import Series
from .base import Index
from .frozen import FrozenList

_str = str
_T = TypeVar("_T", _str, int)
_ArrayLike = Union[List[_T], Series[_T], _np.ndarray]

class MultiIndex(Index):
    @property
    def names(self) -> FrozenList[str]: ...
    @property
    def levels(self) -> FrozenList[Index[_T]]: ...
    @property
    def codes(self) -> FrozenList[_np.ndarray[_np.int8]]: ...
    @property
    def nlevels(self) -> int: ...
    @property
    def levshape(self) -> Tuple[int, ...]: ...
    @classmethod
    def from_arrays(
        cls,
        arrays: Sequence[_ArrayLike],
        sort_order: Optional[bool] = ...,
        names: Optional[Union[List[str], Tuple[str, ...]]] = ...,
    ) -> MultiIndex: ...
    @classmethod
    def from_product(
        cls,
        iterables: Sequence[Iterable[_T]],
        sort_order: Optional[bool] = ...,
        names: Optional[Union[List[str], Tuple[str, ...]]] = ...,
    ) -> MultiIndex: ...
    @classmethod
    def from_tuples(
        cls,
        tuples: Sequence[Tuple[_T, ...]],
        sort_order: Optional[bool] = ...,
        names: Optional[Union[List[str], Tuple[str, ...]]] = ...,
    ) -> MultiIndex: ...
    @classmethod
    def from_frame(
        cls,
        df: DataFrame,
        sort_order: Optional[bool] = ...,
        names: Optional[Union[List[str], Tuple[str, ...]]] = ...,
    ) -> MultiIndex: ...

from typing import Union, overload, Tuple, List, Generic, Hashable
import numpy as _np

from .series import Series, _DType
from .frame import DataFrame
from .indexes import Index

_IndexType = Union[slice, _np.ndarray[_np.int64], Index[int], List[int], Series[int]]
_MaskType = Union[Series[bool], _np.ndarray[_np.bool_], List[bool]]
_StrLike = Union[str, _np.str_]

class _iLocIndexerFrame:
    # get item
    @overload
    def __getitem__(self, idx: int) -> Series: ...
    @overload
    def __getitem__(self, idx: Tuple[int, int]) -> float: ...
    @overload
    def __getitem__(self, idx: _IndexType) -> DataFrame: ...
    @overload
    def __getitem__(self, idx: Tuple[_IndexType, _IndexType]) -> DataFrame: ...
    @overload
    def __getitem__(self, idx: Tuple[_IndexType, int]) -> Series: ...
    @overload
    def __getitem__(self, idx: Tuple[int, _IndexType]) -> Series: ...
    # set item
    @overload
    def __setitem__(self, idx: int, value: Union[float, Series]) -> None: ...
    @overload
    def __setitem__(self, idx: Tuple[int, int], value: float) -> None: ...
    @overload
    def __setitem__(self, idx: _IndexType, value: Union[float, Series, DataFrame]) -> None: ...
    @overload
    def __setitem__(
        self, idx: Tuple[_IndexType, _IndexType], value: Union[float, Series, DataFrame]
    ) -> None: ...
    @overload
    def __setitem__(self, idx: Tuple[_IndexType, int], value: Union[float, Series]) -> None: ...
    @overload
    def __setitem__(self, idx: Tuple[int, _IndexType], value: Union[float, Series]) -> None: ...

class _iLocIndexerSeries(Generic[_DType]):
    # get item
    @overload
    def __getitem__(self, idx: int) -> _DType: ...
    @overload
    def __getitem__(self, idx: _IndexType) -> Series[_DType]: ...
    # set item
    @overload
    def __setitem__(self, idx: int, value: _DType) -> None: ...
    @overload
    def __setitem__(self, idx: _IndexType, value: Union[_DType, Series[_DType]]) -> None: ...

class _LocIndexerFrame:
    # get item
    @overload
    def __getitem__(self, idx: Union[_MaskType, _IndexType]) -> DataFrame: ...
    @overload
    def __getitem__(self, idx: _StrLike) -> Series: ...
    @overload
    def __getitem__(self, idx: List[_StrLike]) -> DataFrame: ...
    @overload
    def __getitem__(
        self,
        idx: Tuple[
            Union[slice, _MaskType, _IndexType, List[str]], Union[_MaskType, List[str], str]
        ],
    ) -> DataFrame: ...
    @overload
    def __getitem__(self, idx: Tuple[_StrLike, _StrLike]) -> float: ...
    # set item
    @overload
    def __setitem__(
        self, idx: Union[_MaskType, _IndexType], value: Union[float, _np.ndarray, DataFrame]
    ) -> None: ...
    @overload
    def __setitem__(self, idx: _StrLike, value: Union[float, Series, _np.ndarray]) -> None: ...
    @overload
    def __setitem__(
        self, idx: List[_StrLike], value: Union[float, _np.ndarray, DataFrame]
    ) -> None: ...
    @overload
    def __setitem__(self, idx: Tuple[_IndexType, str], value: Union[_IndexType, float]) -> None: ...
    @overload
    def __setitem__(
        self,
        idx: Tuple[Union[_MaskType, _IndexType, List[str]], Union[_MaskType, List[str]]],
        value: Union[DataFrame, Series, float],
    ) -> None: ...

class _AtIndexerFrame:
    # get item
    def __getitem__(self, idx: Tuple[int, Hashable]) -> Union[int, float, str]: ...
    # set item
    def __setitem__(self, idx: Tuple[int, Hashable], value: Union[int, float, str]) -> None: ...

class _AtIndexerSeries(Generic[_DType]):
    # get item
    def __getitem__(self, idx: _StrLike) -> _DType: ...
    # set item
    def __setitem__(self, idx: _StrLike, value: _DType) -> None: ...

class _LocIndexerSeries(Generic[_DType]):
    # get item
    @overload
    def __getitem__(self, idx: _MaskType) -> Series[_DType]: ...
    @overload
    def __getitem__(self, idx: str) -> _DType: ...
    @overload
    def __getitem__(self, idx: List[str]) -> Series[_DType]: ...
    @overload
    # set item
    def __setitem__(
        self, idx: _MaskType, value: Union[_DType, _np.ndarray, Series[_DType]]
    ) -> None: ...
    @overload
    def __setitem__(self, idx: str, value: _DType) -> None: ...
    @overload
    def __setitem__(
        self, idx: List[str], value: Union[_DType, _np.ndarray, Series[_DType]]
    ) -> None: ...

# Local Variables:
# blacken-line-length: 100
# blacken-allow-py36: t
# blacken-skip-string-normalization: t
# End:

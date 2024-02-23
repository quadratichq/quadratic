from typing import Tuple, Union, overload
from typing_extensions import Literal

from numpy import ndarray, _Int, float64, _DType

def slogdet(
    a: ndarray[_DType],
) -> Union[Tuple[float64, float64], Tuple[ndarray[float64], ndarray[float64]]]: ...
@overload
def svd(
    a: ndarray[_DType],
    full_matrices: bool = ...,
    compute_uv: Literal[True] = ...,
    hermitian: bool = ...,
) -> Tuple[ndarray[_DType], ndarray[_DType], ndarray[_DType]]: ...
@overload
def svd(
    a: ndarray[_DType],
    *,
    compute_uv: Literal[False],
    full_matrices: bool = ...,
    hermitian: bool = ...,
) -> ndarray[_DType]: ...

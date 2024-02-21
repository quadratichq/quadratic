from typing import Iterable, List, Optional, Sequence, Tuple, TypeVar, Union, overload
from typing_extensions import Literal

from . import (
    _ArrayLike,
    _DType,
    _Float,
    _FloatLike,
    _Int,
    _IntLike,
    _ShapeType,
    float64,
    int64,
    ndarray,
)

_T = TypeVar("_T")
@overload
def binomial(n: _IntLike, p: _FloatLike) -> _Int: ...
@overload
def binomial(n: _IntLike, p: _FloatLike, size: _IntLike) -> ndarray[_Int]: ...
@overload
def binomial(n: _IntLike, p: _ArrayLike[_Float], size: ndarray[_Int] = ...) -> ndarray[_Int]: ...
@overload
def binomial(n: _ArrayLike[_Int], p: _FloatLike, size: ndarray[_Int] = ...) -> ndarray[_Int]: ...
@overload
def binomial(
    n: _ArrayLike[_Int], p: _ArrayLike[_Float], size: ndarray[_Int] = ...
) -> ndarray[_Int]: ...
@overload
def choice(a: _IntLike) -> _IntLike: ...
@overload
def choice(a: _Int, size: int) -> ndarray[_Int]: ...
@overload
def choice(a: int, size: int) -> ndarray[int64]: ...
@overload
def choice(a: _IntLike, size: _IntLike, replace: bool) -> ndarray[int64]: ...
@overload
def choice(
    a: List[_T], p: Union[List[_FloatLike], ndarray[_Float]] = ..., replace: bool = ...
) -> _T: ...
@overload
def choice(
    a: range, size: _IntLike, replace: bool = ..., p: Union[List[_FloatLike], ndarray[_Float]] = ...
) -> ndarray[int64]: ...
@overload
def choice(
    a: range, *, replace: bool = ..., p: Union[List[_FloatLike], ndarray[_Float]] = ...
) -> int64: ...
@overload
def choice(
    a: ndarray[_DType],
    size: _IntLike,
    replace: bool = ...,
    p: Union[List[_FloatLike], ndarray[_Float]] = ...,
) -> ndarray[_DType]: ...
@overload
def choice(
    a: ndarray[_DType], *, replace: bool = ..., p: Union[List[_FloatLike], ndarray[_Float]] = ...
) -> _DType: ...
def default_rng(seed: Optional[int] = ...) -> Generator: ...
def dirichlet(alpha: ndarray[_DType], size: _IntLike = ...) -> ndarray[_DType]: ...
@overload
def exponential(scale: _FloatLike) -> _Float: ...
@overload
def exponential(scale: _FloatLike, size: Sequence[_IntLike]) -> ndarray[float64]: ...
@overload
def exponential(scale: Sequence[_FloatLike], size: Sequence[_IntLike]) -> ndarray[float64]: ...
def geometric(p: float, size: _IntLike) -> ndarray[float64]: ...
def get_state() -> Tuple[str, ndarray[_Int], _IntLike, _IntLike, _FloatLike]: ...
def normal(loc: float, scale: float, size: Union[int, Tuple[int, ...]]) -> ndarray[float64]: ...
@overload
def permutation(size: int) -> ndarray[int64]: ...
@overload
def permutation(size: Iterable[_DType]) -> ndarray[_DType]: ...
def rand(*args: int) -> ndarray[_Float]: ...
def randn(*args: int) -> ndarray[_Float]: ...
@overload
def randint(low: int, high: int = ...) -> int64: ...
@overload
def randint(low: int, size: Tuple[int, ...], high: int = ...) -> ndarray[int64]: ...
@overload
def randint(low: int, size: int, high: int = ...) -> ndarray[int64]: ...
def seed(s: int) -> None: ...
def set_state(state: Tuple[str, ndarray[_Int], _IntLike, _IntLike, _FloatLike]) -> None: ...
def shuffle(x: ndarray) -> None: ...
@overload
def uniform() -> float64: ...
@overload
def uniform(size: _ShapeType) -> ndarray: ...
@overload
def uniform(low: float, high: float, size: _ShapeType) -> ndarray: ...

class Generator:
    def __init__(self, seed: int = ...): ...
    @overload
    def choice(self, a: _IntLike) -> _IntLike: ...
    @overload
    def choice(self, a: _Int, size: int) -> ndarray[_Int]: ...
    @overload
    def choice(self, a: int, size: int) -> ndarray[int64]: ...
    @overload
    def choice(self, a: _IntLike, size: _IntLike, replace: bool) -> ndarray[int64]: ...
    @overload
    def choice(
        self, a: List[_T], p: Union[List[_FloatLike], ndarray[_Float]] = ..., replace: bool = ...
    ) -> _T: ...
    @overload
    def choice(
        self,
        a: range,
        size: _IntLike,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> ndarray[int64]: ...
    @overload
    def choice(
        self, a: range, *, replace: bool = ..., p: Union[List[_FloatLike], ndarray[_Float]] = ...
    ) -> int64: ...
    @overload
    def choice(
        self,
        a: ndarray[_DType],
        size: _IntLike,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> ndarray[_DType]: ...
    @overload
    def choice(
        self,
        a: ndarray[_DType],
        *,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> _DType: ...
    def normal(
        self,
        loc: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...
    def permutation(self, size: int) -> ndarray[int64]: ...
    def shuffle(self, x: ndarray) -> None: ...
    def beta(
        self,
        a: Union[float, ndarray[_DType]] = ...,
        b: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a Beta distribution.
    def binomial(
        self,
        n: Union[int, ndarray[_DType]] = ...,
        p: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a binomial distribution.
    def chisquare(
        self, df: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a chi-square distribution.
    def dirichlet(
        self, alpha: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from the Dirichlet distribution.
    def exponential(
        self, scale: float, size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from an exponential distribution.
    def f(
        self,
        dfnum: Union[float, ndarray[_DType]] = ...,
        dfden: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from an F distribution.
    def gamma(
        self,
        shape: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a Gamma distribution.
    def geometric(
        self, p: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from the geometric distribution.
    def gumbel(
        self,
        loc: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a Gumbel distribution.
    def hypergeometric(
        self,
        ngood: Union[int, ndarray[_DType]] = ...,
        nbad: Union[int, ndarray[_DType]] = ...,
        nsample: Union[int, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a Hypergeometric distribution.
    def laplace(
        self,
        loc: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[
        _DType
    ]: ...  # Draw samples from the Laplace or double exponential distribution with specified location (or mean) and scale (decay).
    def logistic(
        self,
        loc: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a logistic distribution.
    def lognormal(
        self,
        mean: Union[float, ndarray[_DType]] = ...,
        sigma: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a log-normal distribution.
    def logseries(
        self, p: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a logarithmic series distribution.
    def multimonial(
        self,
        n: Union[int, ndarray[_DType]] = ...,
        pvals: ndarray[_DType] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a multinomial distribution.
    def multivariate_hypergeometric(
        self, colors: Sequence[int], nsample: int
    ) -> ndarray[_DType]: ...  # Generate variates from a multivariate hypergeometric distribution.
    def multivariate_normal(
        self,
        mean: ndarray[_DType] = ...,
        cov: ndarray[_DType] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a multivariate normal distribution.
    def negative_binomial(
        self,
        n: Union[float, ndarray[_DType]] = ...,
        p: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a negative binomial distribution.
    def noncentral_chisquare(
        self,
        df: Union[float, ndarray[_DType]] = ...,
        nonc: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a noncentral chi-square distribution.
    def noncentral_f(
        self,
        dfnum: Union[float, ndarray[_DType]] = ...,
        dfden: Union[float, ndarray[_DType]] = ...,
        nonc: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from the noncentral F distribution.
    def pareto(
        self, a: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[
        _DType
    ]: ...  # Draw samples from a Pareto II or Lomax distribution with specified shape.
    def poisson(
        self, lam: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a Poisson distribution.
    def power(
        self, a: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[
        _DType
    ]: ...  # Draws samples in [0, 1] from a power distribution with positive exponent a - 1.
    def rayleigh(
        self, scale: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a Rayleigh distribution.
    def standard_cauchy(
        self, size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a standard Cauchy distribution with mode = 0.
    def standard_exponential(
        self,
        size: Union[int, ndarray[_DType]] = ...,
        dtype: Optional[_DType] = ...,
        method: Optional[Literal["inv", "zig"]] = ...,
        out: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from the standard exponential distribution.
    def standard_gamma(
        self,
        shape: Union[float, ndarray[_DType]] = ...,
        size: Union[float, ndarray[_DType]] = ...,
        dtype: Optional[_DType] = ...,
        out: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a standard Gamma distribution.
    def standard_normal(
        self,
        size: Union[int, ndarray[_DType]] = ...,
        dtype: Optional[_DType] = ...,
        out: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a standard Normal distribution (mean=0, stdev=1).
    def standard_t(
        self, df: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[
        _DType
    ]: ...  # Draw samples from a standard Student’s t distribution with df degrees of freedom.
    def triangular(
        self,
        left: Union[float, ndarray[_DType]] = ...,
        mode: Union[float, ndarray[_DType]] = ...,
        right: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[
        _DType
    ]: ...  # Draw samples from the triangular distribution over the interval [left, right].
    def uniform(
        self,
        low: Union[float, ndarray[_DType]] = ...,
        high: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a uniform distribution.
    def vonmises(
        self,
        mu: Union[float, ndarray[_DType]] = ...,
        kappa: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a von Mises distribution.
    def wald(
        self,
        mean: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...  # Draw samples from a Wald, or inverse Gaussian, distribution.
    def weibull(
        self, a: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a Weibull distribution.
    def zipf(
        self, a: Union[float, ndarray[_DType]] = ..., size: Optional[_ShapeType] = ...
    ) -> ndarray[_DType]: ...  # Draw samples from a Zipf distribution.

class RandomState:
    def __init__(self, seed: int = ...): ...
    def multivariate_normal(
        self,
        mean: ndarray[_DType] = ...,
        cov: ndarray[_DType] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...
    def normal(
        self,
        loc: Union[float, ndarray[_DType]] = ...,
        scale: Union[float, ndarray[_DType]] = ...,
        size: Optional[_ShapeType] = ...,
    ) -> ndarray[_DType]: ...
    def permutation(self, size: int) -> ndarray[int64]: ...
    def shuffle(self, x: ndarray) -> None: ...
    def uniform(self, size: _ShapeType) -> ndarray: ...
    @overload
    def choice(self, a: _IntLike) -> _IntLike: ...
    @overload
    def choice(self, a: _Int, size: int) -> ndarray[_Int]: ...
    @overload
    def choice(self, a: int, size: int) -> ndarray[int64]: ...
    @overload
    def choice(self, a: _IntLike, size: _IntLike, replace: bool) -> ndarray[int64]: ...
    @overload
    def choice(
        self, a: List[_T], p: Union[List[_FloatLike], ndarray[_Float]] = ..., replace: bool = ...
    ) -> _T: ...
    @overload
    def choice(
        self,
        a: range,
        size: _IntLike,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> ndarray[int64]: ...
    @overload
    def choice(
        self, a: range, *, replace: bool = ..., p: Union[List[_FloatLike], ndarray[_Float]] = ...
    ) -> int64: ...
    @overload
    def choice(
        self,
        a: ndarray[_DType],
        size: _IntLike,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> ndarray[_DType]: ...
    @overload
    def choice(
        self,
        a: ndarray[_DType],
        *,
        replace: bool = ...,
        p: Union[List[_FloatLike], ndarray[_Float]] = ...,
    ) -> _DType: ...

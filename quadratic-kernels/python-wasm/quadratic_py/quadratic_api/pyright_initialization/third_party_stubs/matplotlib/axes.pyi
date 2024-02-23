from typing import Union, Sequence, Tuple, List, Optional, TypeVar
from typing_extensions import Literal

import numpy as _np

from .artist import Artist, Line2D, LineCollection, Rectangle
from .collections import PolyCollection, PathCollection
from .color import Normalize
from .pyplot import Figure
from .legend import Legend
from .pyplot import Data, NumericArray
from .image import AxesImage
from .text import Text

_Float = TypeVar("_Float", _np.float32, _np.float64)

_LegendLocation = Literal[
    "best",
    "upper right",
    "upper left",
    "lower left",
    "lower right",
    "center left",
    "center right",
    "lower center",
    "upper center",
    "center",
]

class Axes:
    title: Text
    def axvline(
        self,
        x: float = ...,
        ymin: float = ...,
        ymax: float = ...,
        color: str = ...,
        linestyle: Literal["-", "--", "-.", ":", ""] = ...,
    ) -> Line2D: ...
    def set_xlabel(self, xlabel: str) -> None: ...
    def set_ylabel(self, ylabel: str) -> None: ...
    def set_title(self, label: str, loc: Literal["left", "center", "right"] = ...) -> None: ...
    def set_xticks(self, ticks: Union[_np.ndarray[_Float], Sequence[float]]) -> None: ...
    def set_yticks(self, ticks: Union[_np.ndarray[_Float], Sequence[float]]) -> None: ...
    def set_xticklabels(self, labels: List[str]) -> Text: ...
    def set_yticklabels(self, labels: List[str]) -> Text: ...
    def grid(
        self,
        b: Optional[bool] = ...,
        which: Literal["major", "minor", "both"] = ...,
        axis: Literal["both", "x", "y"] = ...,
    ) -> None: ...
    def get_legend_handles_labels(
        self,
    ) -> Tuple[List[Union[Artist, Tuple[Artist, ...]]], List[str]]: ...
    def get_figure(self) -> Figure: ...
    def legend(
        self,
        handles: Sequence[Union[Artist, Tuple[Artist, ...]]] = ...,
        labels: Sequence[str] = ...,
        loc: _LegendLocation = ...,
        bbox_to_anchor: Tuple[float, float] = ...,
    ) -> Legend: ...
    def errorbar(
        self,
        x: Data,
        y: Data,
        *,
        barsabove: bool = ...,
        capsize: float = ...,
        capthick: float = ...,
        color: Optional[str] = ...,
        ecolor: str = ...,
        elinewidth: float = ...,
        errorevery: int = ...,
        label: str = ...,
        linestyle: Literal["-", "--", "-.", ":", ""] = ...,
        lolims: bool = ...,
        marker: str = ...,
        markersize: float = ...,
        uplims: bool = ...,
        xerr: Optional[Data] = ...,
        xlolims: bool = ...,
        xuplims: bool = ...,
        yerr: Optional[Data] = ...,
        zorder: float = ...,
    ) -> Tuple[Line2D, Line2D, LineCollection]: ...
    def bar(
        self,
        x: Data,
        height: Data,
        width: Data = ...,
        bottom: Data = ...,
        *,
        align: Literal["center", "edge"] = ...,
        color: Optional[str] = ...,
        edgecolor: str = ...,
        hatch: str = ...,
        label: str = ...,
        linewidth: float = ...,
        zorder: float = ...,
    ) -> Tuple[Rectangle, ...]: ...
    def imshow(
        self, X: Data, cmap: str = ..., vmin: float = ..., vmax: float = ...
    ) -> AxesImage: ...
    def hist(
        self, x: Data, bins: Union[int, Sequence[float], _np.ndarray[_Float]]
    ) -> Tuple[List[_np.ndarray], _np.ndarray, List]: ...
    def plot(
        self,
        x: Data,
        y: Data,
        *,
        color: Optional[str] = ...,
        label: str = ...,
        linestyle: Literal["-", "--", "-.", ":", ""] = ...,
        marker: str = ...,
        markerfacecolor: str = ...,
        markersize: float = ...,
        scalex: bool = ...,
        scaley: bool = ...,
        zorder: float = ...,
    ) -> None: ...
    def scatter(
        self,
        x: Data,
        y: Data,
        s: Optional[Union[float, Optional[NumericArray]]] = ...,
        c: Optional[str] = ...,
        cmap: Optional[str] = ...,
        norm: Optional[Normalize] = ...,
        vmin: Optional[float] = ...,
        vmax: Optional[float] = ...,
        marker: Optional[str] = ...,
        alpha: Optional[float] = ...,
        linewidths: Optional[float] = ...,
        verts: Optional[List[Tuple]] = ...,
        edgecolors: Optional[Union[Literal["face", "none"], str, Sequence[str]]] = ...,
        *,
        plotnonfinite: bool = ...,
        data: Optional[Data] = ...,
        label: str = ...,
    ) -> PathCollection: ...
    def set_xlim(
        self, xmin: float = ..., xmax: float = ..., auto: Optional[bool] = ...
    ) -> None: ...
    def set_ylim(
        self, ymin: float = ..., ymax: float = ..., auto: Optional[bool] = ...
    ) -> None: ...
    def vlines(
        self,
        x: Union[_Float, NumericArray],
        ymin: Union[_Float, NumericArray],
        ymax: Union[_Float, NumericArray],
        colors: Union[str, Union[List[str], Tuple[str]]] = ...,
        linestyles: Literal["-", "--", "-.", ":", ""] = ...,
    ) -> LineCollection: ...

class SubplotBase(Axes):
    def is_first_col(self) -> bool: ...
    def is_first_row(self) -> bool: ...
    def is_last_row(self) -> bool: ...
    def is_last_col(self) -> bool: ...

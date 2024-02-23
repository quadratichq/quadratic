from typing import Any, Callable, TypeVar

import numpy as np

# This is normally where ExtensionArray would be defined,
# but we can't do conditional TYPE_CHECKING imports like pandas does.
# So this will work for now.
from ..dtypes.base import _ArrayLike
from ..dtypes.base import _ExtensionArray as ExtensionArray

class ExtensionOpsMixin:
    @classmethod
    def _create_arithmetic_method(
        cls, op: Callable[..., Any]
    ) -> Callable[[Any, Any], ExtensionArray]: ...
    @classmethod
    def _add_arithmetic_ops(cls) -> None: ...
    @classmethod
    def _create_comparison_method(cls, op: Callable[..., Any]) -> Callable[..., bool]: ...
    @classmethod
    def _add_comparison_ops(cls) -> None: ...
    @classmethod
    def _create_logical_method(cls, op: Callable[..., Any]) -> Callable[..., bool]: ...
    @classmethod
    def _add_logical_ops(cls) -> None: ...

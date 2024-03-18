from typing import Any

from quadratic_py import code_trace

class FigureDisplayError(Exception):
    def __init__(self, message: str, *, source_line: int):
        super().__init__(message)
        self._source_line = source_line

    @property
    def source_line(self) -> int:
        return self._source_line


class FigureHolder:
    def __init__(self):
        self._result: Any | None = None
        self._result_set_from_line: int | None = None

    def set_result(self, figure: Any) -> None:
        user_call_frames = code_trace.get_user_frames()
        current_result_set_from_line = (
            user_call_frames[0].lineno if user_call_frames is not None else "unknown"
        )

        if self._result is not None:
            raise FigureDisplayError(
                f"Cannot produce multiple figures from a single cell. "
                f"First produced on line {self._result_set_from_line}, "
                f"then on {current_result_set_from_line}",
                source_line=current_result_set_from_line
            )

        self._result = figure
        self._result_set_from_line = current_result_set_from_line

    @property
    def result(self):
        return self._result

    @property
    def result_set_from_line(self) -> int | None:
        return self._result_set_from_line

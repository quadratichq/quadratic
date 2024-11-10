import micropip

from quadratic_py import code_trace


class FigureDisplayError(Exception):
    def __init__(self, message: str, *, source_line: int):
        super().__init__(message)
        self._source_line = source_line

    @property
    def source_line(self) -> int:
        return self._source_line


class _FigureHolder:
    def __init__(self):
        self._result = None
        self._result_set_from_line = None

    def set_result(self, figure) -> None:
        user_call_frames = code_trace.get_user_frames()
        current_result_set_from_line = (
            user_call_frames[0].lineno if user_call_frames is not None else "unknown"
        )

        if self._result is not None:
            raise FigureDisplayError(
                f"Cannot produce multiple figures from a single cell. "
                f"First produced on line {self._result_set_from_line}, "
                f"then on {current_result_set_from_line}",
                source_line=current_result_set_from_line,
            )

        self._result = figure
        self._result_set_from_line = current_result_set_from_line

    @property
    def result(self):
        return self._result

    @property
    def result_set_from_line(self) -> int | None:
        return self._result_set_from_line


async def intercept_plotly_html(code) -> _FigureHolder | None:
    import pyodide.code

    if "plotly" not in pyodide.code.find_imports(code):
        return None

    await micropip.install("plotly")
    import plotly.io
    from plotly.basedatatypes import BaseFigure

    # TODO: It would be nice if we could prevent the user from setting the default renderer
    plotly.io.renderers.default = "browser"
    figure_holder = _FigureHolder()

    plotly.io._base_renderers.open_html_in_browser = _make_open_html_patch(
        figure_holder.set_result
    )

    BaseFigure.show = _custom_show

    return figure_holder


def _make_open_html_patch(figure_saver):
    def open_html_in_browser(html, *args, **kwargs):
        figure_saver(html)

    return open_html_in_browser


# Override the default show method for plotly figures
def _custom_show(self):
    html = self.to_html(include_plotlyjs="cdn", include_mathjax="cdn").replace(
        ' src="https://', ' crossorigin="anonymous" src="https://'
    )
    return html

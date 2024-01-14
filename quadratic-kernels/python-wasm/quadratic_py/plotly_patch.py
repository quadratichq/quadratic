import micropip

from quadratic_py.figure_holder import FigureHolder


async def intercept_plotly_html(code, figure_holder: FigureHolder) -> None:
    import pyodide.code
    if "plotly" not in pyodide.code.find_imports(code):
        return

    await micropip.install("plotly")
    import plotly.io

    # TODO: It would be nice if we could prevent the user from setting the default renderer
    plotly.io.renderers.default = "browser"

    plotly.io._base_renderers.open_html_in_browser = _make_open_html_patch(figure_holder.set_result)


def _make_open_html_patch(figure_saver):
    def open_html_in_browser(html, *args, **kwargs):
        print(html)
        figure_saver(html)

    return open_html_in_browser

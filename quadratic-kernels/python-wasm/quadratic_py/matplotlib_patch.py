import io
from pprint import pprint
from typing import Any

import micropip

from quadratic_py.figure_holder import FigureHolder


def figure_to_png(figure: Any) -> io.BytesIO:
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png")
    buffer.seek(0)
    return buffer


async def intercept_matplotlib_show(code, figure_holder: FigureHolder):
    import pyodide.code
    if "matplotlib" not in pyodide.code.find_imports(code):
        return

    await micropip.install("matplotlib")

    import matplotlib.pyplot
    import matplotlib.backend_bases
    import matplotlib.backends.backend_agg

    @matplotlib.backend_bases._Backend.export
    class _MatplotlibIntercepter(matplotlib.backend_bases._Backend):
        class _InterceptingManager(matplotlib.backend_bases.FigureManagerBase):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                print("CREATED")

            def show(self, *args, **kwargs):
                _MatplotlibIntercepter.show(*args, **kwargs)

        FigureCanvas = matplotlib.backends.backend_agg.FigureCanvasAgg
        FigureManager = _InterceptingManager

        @staticmethod
        def show(*args, **kwargs):
            figure = matplotlib.pyplot.gcf()
            buffer = figure_to_png(figure)
            figure_holder.set_result(buffer)

    _MatplotlibIntercepter.FigureCanvas.manager_class = _MatplotlibIntercepter.FigureManager
    matplotlib.use(f"module://{__name__}")

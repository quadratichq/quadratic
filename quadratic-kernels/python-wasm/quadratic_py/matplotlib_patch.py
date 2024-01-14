import io
from pprint import pprint

import micropip

from quadratic_py.figure_holder import FigureHolder


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
        FigureCanvas = matplotlib.backends.backend_agg.FigureCanvasAgg
        FigureManager = matplotlib.backend_bases.FigureManagerBase

        @staticmethod
        def show(*args, **kwargs):
            # try:
            #     matplotlib.pyplot.clf()
            # except:
            #     pass

            import inspect, pprint
            pprint.pprint(inspect.stack())

            figure = matplotlib.pyplot.gcf()
            buffer = io.BytesIO()
            figure.savefig(buffer, format="png")
            buffer.seek(0)

            figure_holder.set_result(buffer)

    # TODO: fig.show() and matplotlib.pyplot.show(), plus maybe more

    matplotlib.use(f"module://{__name__}")

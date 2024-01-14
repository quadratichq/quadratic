import asyncio
import datetime
import importlib
import pyodide.http
import time
from pathlib import Path

IMPORT_LOCK = asyncio.Lock()
FETCH_TIME = datetime.timedelta(seconds=0.0)
TRACK_FETCH_TIME = True


async def fetch_module(source: str):
    # TODO: pyodide recommends fetching an archive of modules, rather than one at a time
    # https://pyodide.org/en/stable/usage/loading-custom-python-code.html

    assert (
        "." not in source and "/" not in source
    ), "No support for fetching nested modules"

    destination = Path(f"{source}.py")
    if not destination.exists():

        start = time.time()
        async with IMPORT_LOCK:
            response = await pyodide.http.pyfetch(f"/quadratic_py/{source}.py")
            with open(f"{source}.py", "wb+") as f:
                f.write(await response.bytes())
        end = time.time()

        if TRACK_FETCH_TIME:
            global FETCH_TIME
            difference = datetime.timedelta(seconds=end-start)
            FETCH_TIME += difference

            print(f"Fetch time for '{source}': {difference} (cumulative={FETCH_TIME})")

    return importlib.import_module(source)


async def prefetch_modules():
    await fetch_module("code_trace")
    await fetch_module("plotly_patch")
    print("Module prefetch succeeded")

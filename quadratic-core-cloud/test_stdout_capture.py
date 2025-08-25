from contextlib import redirect_stdout
from io import StringIO
import asyncio

# This mimics what the Rust code should generate for:
# print("Nothing")
# None

# Capture stdout for the entire execution
__quadratic_stdout_capture__ = StringIO()

async def __quadratic_execute__():
    print("Nothing")
    return None

# Run with stdout captured
with redirect_stdout(__quadratic_stdout_capture__):
    __quadratic_result__ = asyncio.run(__quadratic_execute__())

# Get captured stdout
__quadratic_std_out__ = __quadratic_stdout_capture__.getvalue()

print("=== TEST RESULTS ===")
print(f"Result: {repr(__quadratic_result__)}")
print(f"Captured stdout: {repr(__quadratic_std_out__)}")
print(f"Stdout length: {len(__quadratic_std_out__)}")
print(f"Stdout is empty: {len(__quadratic_std_out__) == 0}")
print("=== END RESULTS ===")

"""
Code transformation for async cell access when SharedArrayBuffer is unavailable.

When SAB is not available, q.cells() returns a coroutine that needs to be awaited.
This module transforms user code to add `await` before q.cells() calls.

The transformation wraps calls in parentheses to handle edge cases like:
- `return q.cells("A1")` becomes `return (await q.cells("A1"))`
- `x = q.cells("A1")` becomes `x = (await q.cells("A1"))`
"""

import re


def add_await_to_cell_calls(code: str) -> str:
    """
    Transform q.cells(...) calls to (await q.cells(...))

    Note: This regex handles simple cases. For nested parentheses like
    q.cells(get_range()), more sophisticated parsing may be needed.
    """
    # Match q.cells followed by parentheses with content
    # The regex captures the arguments to preserve them
    # Wrapping in parentheses ensures correct precedence for return statements
    return re.sub(
        r'\bq\.cells\s*\(([^)]*)\)',
        r'(await q.cells(\1))',
        code
    )

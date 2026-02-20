"""
Code transformation for async cell access when SharedArrayBuffer is unavailable.

When SAB is not available, q.cells() returns a coroutine that needs to be awaited.
This module transforms user code to add `await` before q.cells() calls.

The transformation wraps calls in parentheses to handle edge cases like:
- `return q.cells("A1")` becomes `return (await q.cells("A1"))`
- `x = q.cells("A1")` becomes `x = (await q.cells("A1"))`
"""

import re


def _find_matching_close_paren(code: str, open_paren_index: int) -> int:
    """
    Return the index of the ')' that matches the '(' at open_paren_index.
    Skips parentheses inside string literals so nested calls like q.cells(get_range("A1:B5")) work.
    """
    depth = 1
    i = open_paren_index + 1
    while i < len(code) and depth > 0:
        c = code[i]
        if c in '"\'':
            quote = c
            if code[i:i + 3] == quote * 3:
                end = code.find(quote * 3, i + 3)
                i = end + 3 if end != -1 else len(code)
            else:
                i += 1
                while i < len(code):
                    if code[i] == '\\':
                        i += 2
                        continue
                    if code[i] == quote:
                        i += 1
                        break
                    i += 1
            continue
        if c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
        i += 1
    return i - 1 if depth == 0 else -1


def add_await_to_cell_calls(code: str) -> str:
    """
    Transform q.cells(...) calls to (await q.cells(...)).
    Uses balanced parenthesis matching so nested calls like q.cells(get_range("A1:B5")) work.
    """
    result = []
    last_end = 0
    for match in re.finditer(r'\bq\.cells\s*\(', code):
        open_paren_index = match.end() - 1
        close_paren_index = _find_matching_close_paren(code, open_paren_index)
        if close_paren_index == -1:
            continue
        result.append(code[last_end : match.start()])
        args = code[open_paren_index + 1 : close_paren_index]
        result.append(f'(await q.cells({args}))')
        last_end = close_paren_index + 1
    result.append(code[last_end:])
    return ''.join(result)

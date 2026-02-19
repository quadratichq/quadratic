import unittest

from quadratic_py.transform_async import add_await_to_cell_calls


class TestTransformAsync(unittest.TestCase):
    def test_simple_string_arg(self):
        self.assertEqual(add_await_to_cell_calls('q.cells("A1")'), '(await q.cells("A1"))')
        self.assertEqual(add_await_to_cell_calls("q.cells('A1')"), "(await q.cells('A1'))")
        self.assertEqual(add_await_to_cell_calls('q.cells("A1:B5")'), '(await q.cells("A1:B5"))')

    def test_return_statement(self):
        self.assertEqual(
            add_await_to_cell_calls('return q.cells("A1")'),
            'return (await q.cells("A1"))',
        )

    def test_assignment(self):
        self.assertEqual(
            add_await_to_cell_calls('x = q.cells("A1")'),
            'x = (await q.cells("A1"))',
        )

    def test_nested_parens(self):
        self.assertEqual(
            add_await_to_cell_calls('q.cells(get_range("A1:B5"))'),
            '(await q.cells(get_range("A1:B5")))',
        )
        self.assertEqual(
            add_await_to_cell_calls('return q.cells(get_range("A1"))'),
            'return (await q.cells(get_range("A1")))',
        )

    def test_multiple_calls(self):
        self.assertEqual(
            add_await_to_cell_calls('q.cells("A1"); q.cells("B2")'),
            '(await q.cells("A1")); (await q.cells("B2"))',
        )

    def test_no_q_cells_unchanged(self):
        code = 'x = 1\nprint("hello")'
        self.assertEqual(add_await_to_cell_calls(code), code)

    def test_not_part_of_identifier(self):
        self.assertEqual(add_await_to_cell_calls('my_q.cells("A1")'), 'my_q.cells("A1")')

    def test_triple_quoted_string_in_arg(self):
        code = 'q.cells("""A1:B5""")'
        self.assertEqual(add_await_to_cell_calls(code), '(await q.cells("""A1:B5"""))')

    def test_deeply_nested_parens(self):
        self.assertEqual(
            add_await_to_cell_calls('q.cells(foo(bar("x")))'),
            '(await q.cells(foo(bar("x"))))',
        )

from datetime import datetime
from unittest import TestCase

import pandas as pd
from dateutil.relativedelta import relativedelta
from quadratic_py.process_output import process_output_value
from quadratic_py.utils import CellValueType


def assert_pov(
    self,
    input,
    typed_array_output,
    array_output,
    output_size,
    output_value,
    output_type,
):
    result = process_output_value(input)
    self.assertEqual(result["typed_array_output"], typed_array_output)
    self.assertEqual(result["array_output"], array_output)
    self.assertEqual(result["output_size"], output_size)
    self.assertEqual(result["output_value"], output_value)
    self.assertEqual(result["output_type"], output_type)


class TestProcessOutput(TestCase):
    def test_value(self):
        assert_pov(self, 1, None, None, None, ("1", CellValueType.Number), "int")
        assert_pov(self, 1.1, None, None, None, ("1.1", CellValueType.Number), "float")
        assert_pov(self, -1, None, None, None, ("-1", CellValueType.Number), "int")
        assert_pov(self, "hello", None, None, None, ("hello", CellValueType.Text), "str")
        assert_pov(self, True, None, None, None, ("True", CellValueType.Boolean), "bool")
        assert_pov(self, False, None, None, None, ("False", CellValueType.Boolean), "bool")
        assert_pov(self, "abc", None, None, None, ("abc", CellValueType.Text), "str")
        assert_pov(self, "1", None, None, None, ("1", CellValueType.Text), "str")
        assert_pov(self, "True", None, None, None, ("True", CellValueType.Text), "str")
        assert_pov(self, "False", None, None, None, ("False", CellValueType.Text), "str")
        assert_pov(self, "true", None, None, None, ("true", CellValueType.Text), "str")
        assert_pov(self, "false", None, None, None, ("false", CellValueType.Text), "str")
        assert_pov(self, "123abc", None, None, None, ("123abc", CellValueType.Text), "str")
        assert_pov(self, "abc123", None, None, None, ("abc123", CellValueType.Text), "str")
        assert_pov(self, None, None, None, None, None, "NoneType")
        assert_pov(self, "", None, None, None, ("", CellValueType.Blank), "str")
        assert_pov(self, " ", None, None, None, (" ", CellValueType.Text), "str")
        assert_pov(
            self,
            datetime(2021, 1, 1),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", CellValueType.DateTime),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", CellValueType.DateTime),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0, 0),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", CellValueType.DateTime),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0, 0, None),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", CellValueType.DateTime),
            "datetime",
        )
        assert_pov(
            self,
            relativedelta(years=1, months=2, weeks=3, days=4, hours=5, minutes=6, seconds=7.5, microseconds=155),
            None,
            None,
            None,
            ("1y 2mo 25d 5h 6m 7.5s 155µs", CellValueType.Duration),
            "relativedelta",
        )

    def test_list(self):
        assert_pov(
            self,
            [1, 2, 3],
            [("1", CellValueType.Number), ("2", CellValueType.Number), ("3", CellValueType.Number)],
            [1, 2, 3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            [1.1, 2.2, 3.3],
            [("1.1", CellValueType.Number), ("2.2", CellValueType.Number), ("3.3", CellValueType.Number)],
            [1.1, 2.2, 3.3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            [-1, -2, -3],
            [("-1", CellValueType.Number), ("-2", CellValueType.Number), ("-3", CellValueType.Number)],
            [-1, -2, -3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            ["1", "2", "3"],
            [("1", CellValueType.Text), ("2", CellValueType.Text), ("3", CellValueType.Text)],
            ["1", "2", "3"],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            ["hello", "world"],
            [("hello", CellValueType.Text), ("world", CellValueType.Text)],
            ["hello", "world"],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [True, False],
            [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
            [True, False],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [None, None],
            [("", CellValueType.Blank), ("", CellValueType.Blank)],
            [None, None],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            ["", " "],
            [("", CellValueType.Blank), (" ", CellValueType.Text)],
            ["", " "],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [datetime(2021, 1, 1), datetime(2021, 1, 2)],
            [
                ("2021-01-01T00:00:00", CellValueType.DateTime),
                ("2021-01-02T00:00:00", CellValueType.DateTime),
            ],
            [datetime(2021, 1, 1), datetime(2021, 1, 2)],
            (1, 2),
            None,
            "list",
        )

    def test_2d_list(self):
        assert_pov(
            self,
            [[1, 2, 3]],
            [[("1", CellValueType.Number), ("2", CellValueType.Number), ("3", CellValueType.Number)]],
            [[1, 2, 3]],
            (3, 1),
            None,
            "list",
        )
        assert_pov(
            self,
            [[1, 2, 3], [4, 5, 6]],
            [
                [("1", CellValueType.Number), ("2", CellValueType.Number), ("3", CellValueType.Number)],
                [("4", CellValueType.Number), ("5", CellValueType.Number), ("6", CellValueType.Number)],
            ],
            [[1, 2, 3], [4, 5, 6]],
            (3, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]],
            [
                [("1.1", CellValueType.Number), ("2.2", CellValueType.Number), ("3.3", CellValueType.Number)],
                [("4.4", CellValueType.Number), ("5.5", CellValueType.Number), ("6.6", CellValueType.Number)],
            ],
            [[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]],
            (3, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [[-1, -2, -3], [-4, -5, -6]],
            [
                [("-1", CellValueType.Number), ("-2", CellValueType.Number), ("-3", CellValueType.Number)],
                [("-4", CellValueType.Number), ("-5", CellValueType.Number), ("-6", CellValueType.Number)],
            ],
            [[-1, -2, -3], [-4, -5, -6]],
            (3, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [["1", "2", "3"], ["4", "5", "6"]],
            [
                [("1", CellValueType.Text), ("2", CellValueType.Text), ("3", CellValueType.Text)],
                [("4", CellValueType.Text), ("5", CellValueType.Text), ("6", CellValueType.Text)],
            ],
            [["1", "2", "3"], ["4", "5", "6"]],
            (3, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [["hello", "world"], ["hello", "world"]],
            [
                [("hello", CellValueType.Text), ("world", CellValueType.Text)],
                [("hello", CellValueType.Text), ("world", CellValueType.Text)],
            ],
            [["hello", "world"], ["hello", "world"]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [[True, False], [True, False]],
            [
                [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
                [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
            ],
            [[True, False], [True, False]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [[None, None], [None, None]],
            [[("", CellValueType.Blank), ("", CellValueType.Blank)], [("", CellValueType.Blank), ("", CellValueType.Blank)]],
            [[None, None], [None, None]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [["", " "], ["", " "]],
            [[("", CellValueType.Blank), (" ", CellValueType.Text)], [("", CellValueType.Blank), (" ", CellValueType.Text)]],
            [["", " "], ["", " "]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [
                [datetime(2021, 1, 1), datetime(2021, 1, 2)],
                [datetime(2021, 1, 3), datetime(2021, 1, 4)],
            ],
            [
                [
                    ("2021-01-01T00:00:00", CellValueType.DateTime),
                    ("2021-01-02T00:00:00", CellValueType.DateTime),
                ],
                [
                    ("2021-01-03T00:00:00", CellValueType.DateTime),
                    ("2021-01-04T00:00:00", CellValueType.DateTime),
                ],
            ],
            [
                [datetime(2021, 1, 1), datetime(2021, 1, 2)],
                [datetime(2021, 1, 3), datetime(2021, 1, 4)],
            ],
            (2, 2),
            None,
            "list",
        )

    def test_empty_list(self):
        assert_pov(self, [], None, None, None, ("", CellValueType.Blank), "list")
        assert_pov(self, [[]], None, None, None, ("", CellValueType.Blank), "list")

    def test_pandas(self):

        assert_pov(
            self,
            pd.Series([1, 2, 3]),
            [("1", CellValueType.Number), ("2", CellValueType.Number), ("3", CellValueType.Number)],
            [1, 2, 3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([1.1, 2.2, 3.3]),
            [("1.1", CellValueType.Number), ("2.2", CellValueType.Number), ("3.3", CellValueType.Number)],
            [1.1, 2.2, 3.3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([-1, -2, -3]),
            [("-1", CellValueType.Number), ("-2", CellValueType.Number), ("-3", CellValueType.Number)],
            [-1, -2, -3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["1", "2", "3"]),
            [("1", CellValueType.Text), ("2", CellValueType.Text), ("3", CellValueType.Text)],
            ["1", "2", "3"],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["hello", "world"]),
            [("hello", CellValueType.Text), ("world", CellValueType.Text)],
            ["hello", "world"],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([True, False]),
            [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
            [True, False],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([None, None]),
            [("", CellValueType.Blank), ("", CellValueType.Blank)],
            [None, None],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["", " "]),
            [("", CellValueType.Blank), (" ", CellValueType.Text)],
            ["", " "],
            (1, 2),
            None,
            "Series",
        )
        # assert_pov(self, pd.Series([datetime(2021, 1, 1), datetime(2021, 1, 2)]), [('1609459200', 'instant'), ('1609545600', 'instant')], [datetime(2021, 1, 1), datetime(2021, 1, 2)], (1, 2), None, 'Series')

        # test 2d
        assert_pov(
            self,
            pd.DataFrame([[1, 2, 3], [4, 5, 6]]),
            [
                [("1", CellValueType.Number), ("2", CellValueType.Number), ("3", CellValueType.Number)],
                [("4", CellValueType.Number), ("5", CellValueType.Number), ("6", CellValueType.Number)],
            ],
            [[1, 2, 3], [4, 5, 6]],
            (3, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]]),
            [
                [("1.1", CellValueType.Number), ("2.2", CellValueType.Number), ("3.3", CellValueType.Number)],
                [("4.4", CellValueType.Number), ("5.5", CellValueType.Number), ("6.6", CellValueType.Number)],
            ],
            [[1.1, 2.2, 3.3], [4.4, 5.5, 6.6]],
            (3, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([[-1, -2, -3], [-4, -5, -6]]),
            [
                [("-1", CellValueType.Number), ("-2", CellValueType.Number), ("-3", CellValueType.Number)],
                [("-4", CellValueType.Number), ("-5", CellValueType.Number), ("-6", CellValueType.Number)],
            ],
            [[-1, -2, -3], [-4, -5, -6]],
            (3, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([["1", "2", "3"], ["4", "5", "6"]]),
            [
                [("1", CellValueType.Text), ("2", CellValueType.Text), ("3", CellValueType.Text)],
                [("4", CellValueType.Text), ("5", CellValueType.Text), ("6", CellValueType.Text)],
            ],
            [["1", "2", "3"], ["4", "5", "6"]],
            (3, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([["hello", "world"], ["hello", "world"]]),
            [
                [("hello", CellValueType.Text), ("world", CellValueType.Text)],
                [("hello", CellValueType.Text), ("world", CellValueType.Text)],
            ],
            [["hello", "world"], ["hello", "world"]],
            (2, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([[True, False], [True, False]]),
            [
                [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
                [("True", CellValueType.Boolean), ("False", CellValueType.Boolean)],
            ],
            [[True, False], [True, False]],
            (2, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([[None, None], [None, None]]),
            [[("", CellValueType.Blank), ("", CellValueType.Blank)], [("", CellValueType.Blank), ("", CellValueType.Blank)]],
            [[None, None], [None, None]],
            (2, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([["", " "], ["", " "]]),
            [[("", CellValueType.Blank), (" ", CellValueType.Text)], [("", CellValueType.Blank), (" ", CellValueType.Text)]],
            [["", " "], ["", " "]],
            (2, 2),
            None,
            "DataFrame",
        )
        # assert_pov(self, pd.DataFrame([[datetime(2021, 1, 1), datetime(2021, 1, 2)], [datetime(2021, 1, 3), datetime(2021, 1, 4)]]), [[('1609459200', 'instant'), ('1609545600', 'instant')], [('1609632000', 'instant'), ('1609718400', 'instant')]], [[datetime(2021, 1, 1), datetime(2021, 1, 2)], [datetime(2021, 1, 3), datetime(2021, 1, 4)]], (2, 2), None, 'DataFrame')

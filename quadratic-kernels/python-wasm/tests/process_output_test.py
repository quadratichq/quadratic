from datetime import datetime
from unittest import TestCase

import pandas as pd
from quadratic_py.process_output import process_output_value


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
        assert_pov(self, 1, None, None, None, ("1", "number"), "int")
        assert_pov(self, 1.1, None, None, None, ("1.1", "number"), "float")
        assert_pov(self, -1, None, None, None, ("-1", "number"), "int")
        assert_pov(self, "hello", None, None, None, ("hello", "text"), "str")
        assert_pov(self, True, None, None, None, ("True", "logical"), "bool")
        assert_pov(self, False, None, None, None, ("False", "logical"), "bool")
        assert_pov(self, "abc", None, None, None, ("abc", "text"), "str")
        assert_pov(self, "1", None, None, None, ("1", "text"), "str")
        assert_pov(self, "True", None, None, None, ("True", "text"), "str")
        assert_pov(self, "False", None, None, None, ("False", "text"), "str")
        assert_pov(self, "true", None, None, None, ("true", "text"), "str")
        assert_pov(self, "false", None, None, None, ("false", "text"), "str")
        assert_pov(self, "123abc", None, None, None, ("123abc", "text"), "str")
        assert_pov(self, "abc123", None, None, None, ("abc123", "text"), "str")
        assert_pov(self, None, None, None, None, None, "NoneType")
        assert_pov(self, "", None, None, None, ("", "blank"), "str")
        assert_pov(self, " ", None, None, None, (" ", "text"), "str")
        assert_pov(
            self,
            datetime(2021, 1, 1),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", "date time"),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", "date time"),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0, 0),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", "date time"),
            "datetime",
        )
        assert_pov(
            self,
            datetime(2021, 1, 1, 0, 0, 0, 0, None),
            None,
            None,
            None,
            ("2021-01-01T00:00:00", "date time"),
            "datetime",
        )

    def test_list(self):
        assert_pov(
            self,
            [1, 2, 3],
            [("1", "number"), ("2", "number"), ("3", "number")],
            [1, 2, 3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            [1.1, 2.2, 3.3],
            [("1.1", "number"), ("2.2", "number"), ("3.3", "number")],
            [1.1, 2.2, 3.3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            [-1, -2, -3],
            [("-1", "number"), ("-2", "number"), ("-3", "number")],
            [-1, -2, -3],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            ["1", "2", "3"],
            [("1", "text"), ("2", "text"), ("3", "text")],
            ["1", "2", "3"],
            (1, 3),
            None,
            "list",
        )
        assert_pov(
            self,
            ["hello", "world"],
            [("hello", "text"), ("world", "text")],
            ["hello", "world"],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [True, False],
            [("True", "logical"), ("False", "logical")],
            [True, False],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [None, None],
            [("", "blank"), ("", "blank")],
            [None, None],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            ["", " "],
            [("", "blank"), (" ", "text")],
            ["", " "],
            (1, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [datetime(2021, 1, 1), datetime(2021, 1, 2)],
            [
                ("2021-01-01T00:00:00", "date time"),
                ("2021-01-02T00:00:00", "date time"),
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
            [[("1", "number"), ("2", "number"), ("3", "number")]],
            [[1, 2, 3]],
            (3, 1),
            None,
            "list",
        )
        assert_pov(
            self,
            [[1, 2, 3], [4, 5, 6]],
            [
                [("1", "number"), ("2", "number"), ("3", "number")],
                [("4", "number"), ("5", "number"), ("6", "number")],
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
                [("1.1", "number"), ("2.2", "number"), ("3.3", "number")],
                [("4.4", "number"), ("5.5", "number"), ("6.6", "number")],
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
                [("-1", "number"), ("-2", "number"), ("-3", "number")],
                [("-4", "number"), ("-5", "number"), ("-6", "number")],
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
                [("1", "text"), ("2", "text"), ("3", "text")],
                [("4", "text"), ("5", "text"), ("6", "text")],
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
                [("hello", "text"), ("world", "text")],
                [("hello", "text"), ("world", "text")],
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
                [("True", "logical"), ("False", "logical")],
                [("True", "logical"), ("False", "logical")],
            ],
            [[True, False], [True, False]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [[None, None], [None, None]],
            [[("", "blank"), ("", "blank")], [("", "blank"), ("", "blank")]],
            [[None, None], [None, None]],
            (2, 2),
            None,
            "list",
        )
        assert_pov(
            self,
            [["", " "], ["", " "]],
            [[("", "blank"), (" ", "text")], [("", "blank"), (" ", "text")]],
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
                    ("2021-01-01T00:00:00", "date time"),
                    ("2021-01-02T00:00:00", "date time"),
                ],
                [
                    ("2021-01-03T00:00:00", "date time"),
                    ("2021-01-04T00:00:00", "date time"),
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
        assert_pov(self, [], None, None, None, ("", "blank"), "list")
        assert_pov(self, [[]], None, None, None, ("", "blank"), "list")

    def test_pandas(self):

        assert_pov(
            self,
            pd.Series([1, 2, 3]),
            [("1", "number"), ("2", "number"), ("3", "number")],
            [1, 2, 3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([1.1, 2.2, 3.3]),
            [("1.1", "number"), ("2.2", "number"), ("3.3", "number")],
            [1.1, 2.2, 3.3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([-1, -2, -3]),
            [("-1", "number"), ("-2", "number"), ("-3", "number")],
            [-1, -2, -3],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["1", "2", "3"]),
            [("1", "text"), ("2", "text"), ("3", "text")],
            ["1", "2", "3"],
            (1, 3),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["hello", "world"]),
            [("hello", "text"), ("world", "text")],
            ["hello", "world"],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([True, False]),
            [("True", "logical"), ("False", "logical")],
            [True, False],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series([None, None]),
            [("", "blank"), ("", "blank")],
            [None, None],
            (1, 2),
            None,
            "Series",
        )
        assert_pov(
            self,
            pd.Series(["", " "]),
            [("", "blank"), (" ", "text")],
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
                [("1", "number"), ("2", "number"), ("3", "number")],
                [("4", "number"), ("5", "number"), ("6", "number")],
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
                [("1.1", "number"), ("2.2", "number"), ("3.3", "number")],
                [("4.4", "number"), ("5.5", "number"), ("6.6", "number")],
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
                [("-1", "number"), ("-2", "number"), ("-3", "number")],
                [("-4", "number"), ("-5", "number"), ("-6", "number")],
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
                [("1", "text"), ("2", "text"), ("3", "text")],
                [("4", "text"), ("5", "text"), ("6", "text")],
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
                [("hello", "text"), ("world", "text")],
                [("hello", "text"), ("world", "text")],
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
                [("True", "logical"), ("False", "logical")],
                [("True", "logical"), ("False", "logical")],
            ],
            [[True, False], [True, False]],
            (2, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([[None, None], [None, None]]),
            [[("", "blank"), ("", "blank")], [("", "blank"), ("", "blank")]],
            [[None, None], [None, None]],
            (2, 2),
            None,
            "DataFrame",
        )
        assert_pov(
            self,
            pd.DataFrame([["", " "], ["", " "]]),
            [[("", "blank"), (" ", "text")], [("", "blank"), (" ", "text")]],
            [["", " "], ["", " "]],
            (2, 2),
            None,
            "DataFrame",
        )
        # assert_pov(self, pd.DataFrame([[datetime(2021, 1, 1), datetime(2021, 1, 2)], [datetime(2021, 1, 3), datetime(2021, 1, 4)]]), [[('1609459200', 'instant'), ('1609545600', 'instant')], [('1609632000', 'instant'), ('1609718400', 'instant')]], [[datetime(2021, 1, 1), datetime(2021, 1, 2)], [datetime(2021, 1, 3), datetime(2021, 1, 4)]], (2, 2), None, 'DataFrame')

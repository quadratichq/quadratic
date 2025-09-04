import pandas as pd
import ast
import numpy as np
from datetime import date, datetime, time, timedelta
from enum import Enum

# type_u8 as per cellvalue.rs
class CellValueType(Enum):
    Blank = 0
    Text = 1
    Number = 2
    Logical = 3
    Duration = 4
    Error = 5
    Html = 6
    Code = 7
    Image = 8
    Date = 9
    Time = 10
    DateTime = 11
    Import = 12

def isListEmpty(inList):
    if isinstance(inList, list):
        return all(map(isListEmpty, inList))
    return False

def to_iso_format(value):
    return value.isoformat()

def to_quadratic_type(value):
    try:
        if value == None or value == "":
            return ("", CellValueType.Blank.value)
        
        if type(value) == str:
            return (str(value), CellValueType.Text.value)
        
        value = ast.literal_eval(value)
    except:
        pass
    
    try:
        if type(value) == int or type(value) == float or isinstance(value, np.number):
            return (str(value), CellValueType.Number.value)
        elif type(value) == bool:
            return (str(bool(value)), CellValueType.Logical.value)
        elif isinstance(value, np.datetime64):
            return (to_iso_format(pd.Timestamp(value)), CellValueType.DateTime.value)
        elif isinstance(value, pd.Timestamp) or pd.api.types.is_datetime64_dtype(value):
            return (to_iso_format(value), CellValueType.DateTime.value)
        elif isinstance(value, datetime):
            return (to_iso_format(value), CellValueType.DateTime.value)
        elif isinstance(value, date):
            return (to_iso_format(value), CellValueType.Date.value)
        elif isinstance(value, time):
            return (to_iso_format(value), CellValueType.Time.value)
        elif isinstance(value, timedelta):
            return (f"{value.days}d {value.seconds}s {value.microseconds}µs", CellValueType.Duration.value)
        else:
            return (str(value), CellValueType.Text.value)
    except Exception as e:
        return (str(value), CellValueType.Text.value)

def to_html_with_cdn(self):
    html = self.to_html(
        include_plotlyjs="cdn",
        include_mathjax="cdn",
        config={"displaylogo": False},
    ).replace(
        ' src="https://', ' crossorigin="anonymous" src="https://'
    )
    return html

def process_output_value(output_value):
    # return array_output if output is an array
    array_output = None
    output_type = type(output_value).__name__
    output_size = None
    has_headers = False

    # TODO(ddimaria): figure out if we need to covert back to a list for array_output
    # We should have a single output
    if isinstance(output_value, list):
        if len(output_value) > 0 and not isListEmpty(output_value):
            array_output = output_value
            if isinstance(output_value[0], list):
                output_size = (len(output_value[0]), len(output_value))
            else:
                output_size = (1, len(output_value))
        else:
            output_value = ""

    # Convert DF to array_output
    if isinstance(output_value, pd.DataFrame):
        # flip the dataframe shape
        shape = output_value.shape
        output_size = (shape[1], shape[0])
        # If output_value columns is not the default (RangeIndex)
        if type(output_value.columns) != pd.core.indexes.range.RangeIndex:
            has_headers = True

            # Return Column names and values
            array_output = [
                output_value.columns.tolist()
            ] + output_value.values.tolist()

        else:
            # convert nan to None, return PD values list
            array_output = output_value.where(
                output_value.notnull(), None
            ).values.tolist()

    try:
        import plotly

        if isinstance(output_value, plotly.graph_objs._figure.Figure):
            output_value = to_html_with_cdn(output_value)
            output_type = "Chart"
    except:
        pass

    # Convert Pandas.Series to array_output
    if isinstance(output_value, pd.Series):
        if output_value.name is not None:
            has_headers = True

            # Return index names and values
            array_output = [output_value.name] + output_value.to_numpy().tolist()

        else:
            array_output = output_value.to_numpy().tolist()

        output_size = (1, len(array_output))

    typed_array_output = None

    if array_output is not None:
        typed_array_output = []
        # Check array_output is an array before accessing index 0
        is_2d_array = (isinstance(array_output, list) and len(array_output) > 0 and
                        isinstance(array_output[0], list) and len(array_output[0]) > 0)

        # insure that all rows are the same length
        if not is_2d_array:
            typed_array_output = list(map(to_quadratic_type, array_output))
        else:
            length_1d = len(array_output)
            length_2d = max(len(row) for row in array_output)

            # TODO(ddimaria): is this efficient?
            typed_array_output = [
                [0 for i in range(length_2d)] for j in range(length_1d)
            ]

            for row in range(0, length_1d):
                col_length_2d = len(array_output[row])
                for col in range(0, length_2d):
                    if col > col_length_2d - 1:
                        typed_array_output[row][col] = ("", 0)
                    else:
                        typed_array_output[row][col] = to_quadratic_type(
                            array_output[row][col]
                        )

    # removes output_value if there's an array or None
    if array_output is not None or output_value is None:
        output_value = None
    else:
        output_value = to_quadratic_type(output_value)

    return {
        "typed_array_output": typed_array_output,
        "array_output": array_output,
        "output_value": output_value,
        "output_type": output_type,
        "output_size": output_size,
        "has_headers": has_headers,
    }
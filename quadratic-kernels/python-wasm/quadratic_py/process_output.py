import pandas as pd

from .utils import to_quadratic_type


def isListEmpty(inList):
    if isinstance(inList, list):
        return all(map(isListEmpty, inList))
    return False


def process_output_value(output_value):
    # return array_output if output is an array
    array_output = None
    output_type = type(output_value).__name__
    output_size = None

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

    if isinstance(output_value, pd.Series):
        output_size = (1, len(output_value))

    # Convert DF to array_output
    if isinstance(output_value, pd.DataFrame):
        # flip the dataframe shape
        shape = output_value.shape
        output_size = (shape[1], shape[0])
        # If output_value columns is not the default (RangeIndex)
        if type(output_value.columns) != pd.core.indexes.range.RangeIndex:
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
            output_value = output_value.to_html()
            output_type = "Chart"
    except:
        pass

    # Convert Pandas.Series to array_output
    if isinstance(output_value, pd.Series):
        array_output = output_value.to_numpy().tolist()

    typed_array_output = None

    if array_output is not None:
        typed_array_output = []
        is_2d_array = isinstance(array_output[0], list) and len(array_output[0]) > 0

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
                        typed_array_output[row][col] = ("", "blank")
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
    }

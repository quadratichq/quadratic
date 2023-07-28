from ast import PyCF_ALLOW_TOP_LEVEL_AWAIT
from pyodide import CodeRunner


async def inspect_python(code):
    try:
        runner = CodeRunner(
            code,
            return_mode="last_expr_or_assign",
            mode="exec",
            quiet_trailing_semicolon=False,
            flags=PyCF_ALLOW_TOP_LEVEL_AWAIT,
        )
    except Exception as e:
        return None

    if runner.ast.body:
        last_node = runner.ast.body[-1]

        # take last_node and get the line number
        return_value = {
            "lineno": last_node.lineno,
            "col_offset": last_node.col_offset,
            "end_lineno": last_node.end_lineno,
            "end_col_offset": last_node.end_col_offset,
        }

        if hasattr(last_node, "value"):
            return_value["value_type"] = type(last_node.value).__name__

            # if type is name then get the id
            if type(last_node.value).__name__ == "Name":
                return_value["value_type"] = "Variable({})".format(last_node.value.id)

            # if type is call then get the func
            if type(last_node.value).__name__ == "Call":
                if type(last_node.value.func).__name__ == "Name":
                    return_value["value_type"] = "Function({})".format(
                        last_node.value.func.id
                    )
                elif type(last_node.value.func).__name__ == "Attribute":
                    return_value["value_type"] = "Function({})".format(
                        last_node.value.func.attr
                    )

        return return_value

    return None
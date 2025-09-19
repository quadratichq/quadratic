import ast
import sys

def split_code_for_execution(code):
    """
    Parse code and determine if the last statement is an expression.
    Returns (setup_code, expression_code, has_expression)
    """
    try:
        tree = ast.parse(code)
        if not tree.body:
            return (code, None, False)
        
        last_stmt = tree.body[-1]
        
        # Check if the last statement is an expression statement
        if isinstance(last_stmt, ast.Expr):
            # Get the source lines to reconstruct the code properly
            lines = code.split('\n')
            
            # Find the line range of the last statement
            last_line_no = last_stmt.end_lineno or last_stmt.lineno
            first_line_no = last_stmt.lineno
            
            # Split the code
            setup_lines = lines[:first_line_no - 1]  # Lines before the expression
            expr_lines = lines[first_line_no - 1:last_line_no]  # The expression lines
            
            setup_code = '\n'.join(setup_lines) if setup_lines else ''
            expr_code = '\n'.join(expr_lines)
            
            return (setup_code, expr_code, True)
        else:
            # Last statement is not an expression, run everything as statements
            return (code, None, False)
    except SyntaxError:
        # If there's a syntax error, just run the whole thing
        return (code, None, False)
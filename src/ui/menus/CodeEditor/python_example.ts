export const PYTHON_EXAMPLE_CODE = `# Easily access the Grid
# cell(x,y)
# cellArray((x, y), (x, y))
# Easily pass a value for this cell back
# returnResult(value)

result = cell(0, 0)
for row in cellArray((0, 0), (10, 10)):
    if cell in row:
        print(cell)
        result += cell

returnResult(result)
`;

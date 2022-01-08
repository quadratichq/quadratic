export const PYTHON_EXAMPLE_CODE = `# Easily access the Grid
# grid.inputCellArray()

result = 0
for row in grid.inputCellArray():
    if cell in row:
        print(cell)
        result += cell

grid.returnResult(result)`;

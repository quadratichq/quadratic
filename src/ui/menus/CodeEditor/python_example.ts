export const PYTHON_EXAMPLE_CODE = `# Easily access the Grid
# await getCells(x,y,x,y)
# set return or last statement is used

result = 0
for cell in await getCells(0, 0, 0, 6):
    print(cell.value)
    result += int(cell.value)

1/0
`;

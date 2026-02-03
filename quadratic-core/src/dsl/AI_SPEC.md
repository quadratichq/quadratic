# Quadratic DSL - AI Generation Guide

You are generating spreadsheet content using Quadratic DSL. This language creates spreadsheets with data, formulas, and formatting.

## Quick Reference

```
cell <position>: <value>
cell <position>: <value> {<format>}
grid at <position> [[<values>], ...]
table "<name>" at <position> { headers: [...], rows: [[...], ...] }
python at <position> { <code> }
javascript at <position> { <code> }
format <range> {<format>}
```

## Cell Positions

Use Excel-style references: `A1`, `B2`, `Z100`, `AA1`, `AB50`
- Columns: A-Z, then AA-AZ, BA-BZ, etc.
- Rows: 1-based numbers

## Values

| Type | Example |
|------|---------|
| Text | `"Hello World"` |
| Number | `42`, `3.14`, `-100` |
| Boolean | `true`, `false` |
| Formula | `=SUM(A1:A10)`, `=B2*C2` |
| Blank | `blank` |

## Statements

### Single Cell
```
cell A1: "Title"
cell B2: 100
cell C3: =A1+B2
cell D4: "Bold text" {bold}
```

### Grid (Simple Data Layout)
```
grid at A1 [
    ["Name", "Age", "City"]
    ["Alice", 30, "NYC"]
    ["Bob", 25, "LA"]
]
```

With row formatting:
```
grid at A1 [
    ["Product", "Price", "Stock"] {bold, bg:#333, color:#fff}
    ["Widget", 25.99, 100]
    ["Gadget", 49.99, 50]
]
```

Column-oriented (headers on left):
```
grid at A1 orientation:columns [
    ["Name", "Alice", "Bob"]
    ["Age", 30, 25]
    ["City", "NYC", "LA"]
]
```

### Table (Named Data Table)
```
table "Sales" at A1 {
    headers: ["Region", "Q1", "Q2", "Q3", "Q4"]
    rows: [
        ["North", 1000, 1200, 1100, 1300]
        ["South", 800, 900, 950, 1000]
        ["East", 1500, 1400, 1600, 1700]
    ]
}
```

With formatting:
```
table "Budget" at A1 {
    headers: ["Category", "Budgeted", "Actual", "Variance"]
    rows: [
        ["Marketing", 50000, 48000, =C2-B2]
        ["Engineering", 120000, 125000, =C3-B3]
    ]
    formats: {
        headers: {bold, bg:#1a1a2e, color:#fff}
        "Budgeted": {format:currency}
        "Actual": {format:currency}
        "Variance": {format:currency}
    }
}
```

### Code Cells
```
python at A10 {
    import pandas as pd
    
    data = {"name": ["Alice", "Bob"], "age": [30, 25]}
    df = pd.DataFrame(data)
    df
}

javascript at B10 {
    const data = [1, 2, 3, 4, 5];
    data.map(x => x * 2);
}
```

### Range Formatting
```
format A1:D1 {bold, bg:#333, color:#fff}
format B:B {format:currency}
format 5:5 {italic}
format C2:C100 {format:percent, decimals:1}
```

## Format Properties

| Property | Values | Example |
|----------|--------|---------|
| bold | flag | `{bold}` |
| italic | flag | `{italic}` |
| underline | flag | `{underline}` |
| strikethrough | flag | `{strikethrough}` |
| size | number | `{size:14}` |
| color | hex | `{color:#ff0000}` |
| bg | hex | `{bg:#f0f0f0}` |
| align | left, center, right | `{align:center}` |
| valign | top, middle, bottom | `{valign:middle}` |
| format | currency, percent, number, date, datetime | `{format:currency}` |
| decimals | number | `{decimals:2}` |
| border | flag | `{border}` |
| width | number | `{width:150}` |
| height | number | `{height:30}` |

Combine with commas: `{bold, align:center, bg:#eee}`

## Comments
```
# This is a comment - ignored by parser
cell A1: "Data"  # Comments can follow statements
```

## Complete Example

```
# Dashboard: Monthly Sales Report

# Title
cell A1: "Monthly Sales Report" {bold, size:18}
cell A2: "Generated: 2024-01-15"

# Sales Data
table "MonthlySales" at A4 {
    headers: ["Month", "Revenue", "Expenses", "Profit"]
    rows: [
        ["January", 125000, 95000, =B5-C5]
        ["February", 132000, 98000, =B6-C6]
        ["March", 145000, 102000, =B7-C7]
        ["April", 138000, 99000, =B8-C8]
    ]
    formats: {
        headers: {bold, bg:#2d3436, color:#fff}
        "Revenue": {format:currency}
        "Expenses": {format:currency}
        "Profit": {format:currency}
    }
}

# Summary
cell A11: "Total Revenue:" {bold}
cell B11: =SUM(B5:B8) {format:currency}

cell A12: "Total Profit:" {bold}
cell B12: =SUM(D5:D8) {format:currency, bold, color:#27ae60}

# Analysis with Python
python at A15 {
    import matplotlib.pyplot as plt
    
    months = ["Jan", "Feb", "Mar", "Apr"]
    revenue = [125000, 132000, 145000, 138000]
    
    plt.figure(figsize=(8, 4))
    plt.bar(months, revenue, color='#3498db')
    plt.title("Monthly Revenue")
    plt.ylabel("Revenue ($)")
    plt
}
```

## Best Practices

1. **Use tables for structured data** - Tables support column formatting and structured references
2. **Use grids for simple layouts** - When you don't need table features
3. **Place titles above data** - Use cells with formatting for section headers
4. **Group related data** - Leave empty rows between sections
5. **Use formulas for calculations** - Reference other cells with `=` prefix
6. **Format consistently** - Apply similar formatting to similar data types
7. **Use Python/JS for complex analysis** - Code cells can generate charts and perform calculations

## Formula Examples

```
=SUM(A1:A10)           # Sum a range
=AVERAGE(B2:B100)      # Average
=IF(A1>100,"High","Low")  # Conditional
=VLOOKUP(A1,D:E,2,FALSE)  # Lookup
=A1*B1                 # Multiplication
=TODAY()               # Current date
=CONCATENATE(A1," ",B1)   # Text join
```

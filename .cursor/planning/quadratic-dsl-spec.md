# Quadratic DSL Specification

A simple text-based language for AI to generate Quadratic spreadsheets.

**Status:** Draft
**Version:** 0.1
**Last Updated:** 2025-02-03

---

## Overview

This DSL enables AI systems to output structured text that Quadratic can parse and render as a spreadsheet. The design prioritizes:

1. **LLM-friendly syntax** — Simple, consistent patterns that LLMs can generate reliably
2. **Precise positioning** — AI controls where elements are placed
3. **Structural organization** — Tables and grids as first-class concepts
4. **Familiar formulas** — Excel-style `=` prefix for formulas

---

## Core Concepts

| Concept | Description |
|---------|-------------|
| **cell** | Single cell with a value, formula, or text |
| **grid** | Simple data layout (no table semantics) |
| **table** | Formal named table with headers (supports structured references) |
| **python** | Python code cell |
| **javascript** | JavaScript code cell |
| **format** | Styling applied to cells or ranges |

---

## Syntax Reference

### 1. Single Cells

```
cell <position>: <value> [{format}]
```

**Examples:**
```
cell A1: "Title"
cell B2: 1500
cell C3: =SUM(A1:A10)
cell D4: "Revenue" {bold, align:center}
cell E5: 0.15 {format:percent}
```

**Value types:**
- Strings: `"text"` (quoted)
- Numbers: `123`, `45.67`, `-100`
- Formulas: `=FORMULA()` (starts with `=`)
- Booleans: `true`, `false`

---

### 2. Grids (Simple Data Layout)

Grids are simple data layouts without formal table semantics.

```
grid at <position> [orientation:rows|columns] [
  [row1_values...]
  [row2_values...]
]
```

**Default orientation:** `rows` (headers on top, data going down)

**Examples:**
```
# Basic grid
grid at A1 [
  ["Product", "Q1", "Q2", "Q3"]
  ["Widget", 100, 150, 200]
  ["Gadget", 80, 90, 120]
]

# Grid with row-level formatting
grid at A1 [
  ["Product", "Price", "Margin"] {bold, bg:#e0e0e0}
  ["Widget", 25.00, 0.35]
  ["Gadget", 45.00, 0.28]
  ["Total", =SUM(B2:B3), =AVERAGE(C2:C3)] {bold, border-top}
]

# Column-oriented grid (headers on left)
grid at A1 orientation:columns [
  ["Product", "Widget", "Gadget"]
  ["Price", 25.00, 45.00]
  ["Units", 100, 80]
]
```

---

### 3. Tables (Formal Named Tables)

Tables are named, have formal headers, and support structured references like `TableName[ColumnName]`.

```
table "<name>" at <position> [orientation:rows|columns] {
  headers: [col1, col2, ...]
  rows: [
    [val, val, ...]
    [val, val, ...]
  ]
  [formats: { ... }]
}
```

**Examples:**
```
# Basic table
table "Sales" at A1 {
  headers: ["Region", "Revenue", "Growth"]
  rows: [
    ["North", 5000, 0.12]
    ["South", 3000, 0.08]
  ]
}

# Table with column formats
table "Products" at F1 {
  headers: ["Product", "Units", "Price", "Revenue"]
  rows: [
    ["Widget", 500, 25, =C2*D2]
    ["Gadget", 300, 45, =C3*D3]
  ]
  formats: {
    headers: {bold, bg:#e0e0e0}
    Price: {format:currency}
    Revenue: {format:currency}
  }
}

# Reference table columns in formulas
cell H1: =SUM(Products[Revenue])
cell H2: =AVERAGE(Sales[Growth])
```

---

### 4. Code Cells

```
python at <position> {
  # Python code here
  result_expression
}

javascript at <position> {
  // JavaScript code here
  resultExpression
}
```

**Examples:**
```
python at A10 {
  import pandas as pd
  df = pd.read_csv("data.csv")
  df.describe()
}

javascript at D10 {
  const data = await fetch("/api/sales");
  const json = await data.json();
  json.map(row => row.revenue)
}
```

---

### 5. Formatting

#### Cell-level inline format
```
cell A1: "Title" {bold, size:24, align:center}
```

#### Row-level inline format (within grids)
```
grid at A1 [
  ["Header1", "Header2"] {bold, bg:#333, color:#fff}
  ["Value1", "Value2"]
]
```

#### Range format statements
```
format <range> {properties...}
```

**Range formats:**
```
format B:B {format:currency}        # Entire column
format 5:5 {border-bottom}          # Entire row
format A1:C1 {bold, bg:#e0e0e0}     # Specific range
format B2:B100 {format:percent}     # Partial column
```

---

## Format Properties Reference

### Text Styling
| Property | Description | Example |
|----------|-------------|---------|
| `bold` | Bold text | `{bold}` |
| `italic` | Italic text | `{italic}` |
| `underline` | Underlined text | `{underline}` |
| `strikethrough` | Strikethrough text | `{strikethrough}` |
| `size:<n>` | Font size in points | `{size:14}` |

### Colors
| Property | Description | Example |
|----------|-------------|---------|
| `color:<hex>` | Text color | `{color:#ff0000}` |
| `bg:<hex>` | Background color | `{bg:#f0f0f0}` |

### Alignment
| Property | Description | Example |
|----------|-------------|---------|
| `align:left\|center\|right` | Horizontal alignment | `{align:center}` |
| `valign:top\|middle\|bottom` | Vertical alignment | `{valign:middle}` |

### Number Formats
| Property | Description | Example |
|----------|-------------|---------|
| `format:currency` | Currency format ($1,234.56) | `{format:currency}` |
| `format:percent` | Percentage format (12.34%) | `{format:percent}` |
| `format:number` | Number with commas (1,234.56) | `{format:number}` |
| `format:date` | Date format (2024-01-15) | `{format:date}` |
| `format:datetime` | Date + time | `{format:datetime}` |
| `decimals:<n>` | Decimal places | `{decimals:2}` |

### Borders
| Property | Description |
|----------|-------------|
| `border` | All sides |
| `border-top` | Top border only |
| `border-bottom` | Bottom border only |
| `border-left` | Left border only |
| `border-right` | Right border only |

### Sizing
| Property | Description | Example |
|----------|-------------|---------|
| `width:<n>` | Column width in pixels | `{width:150}` |
| `height:<n>` | Row height in pixels | `{height:30}` |

---

## Complete Example

```
# Dashboard title
cell A1: "Q4 Sales Dashboard" {bold, size:24}
cell A2: "Generated 2024-01-15" {color:#666}

# Regional sales grid
grid at A4 [
  ["Region", "Revenue", "Growth", "Target Met"] {bold, bg:#1a1a2e, color:#fff}
  ["North", 125000, 0.15, true]
  ["South", 98000, 0.08, false]
  ["West", 145000, 0.22, true]
  ["East", 112000, 0.11, true]
  ["Total", =SUM(B5:B8), =AVERAGE(C5:C8), ""] {bold, border-top}
]

# Column formats for the grid
format B:B {format:currency}
format C:C {format:percent}

# Formal products table
table "Products" at F4 {
  headers: ["Product", "Units Sold", "Unit Price", "Revenue"]
  rows: [
    ["Widget Pro", 1250, 49.99, =B5*C5]
    ["Widget Lite", 3400, 19.99, =B6*C6]
    ["Gadget X", 890, 79.99, =B7*C7]
    ["Gadget Mini", 2100, 29.99, =B8*C8]
  ]
  formats: {
    headers: {bold, bg:#e0e0e0}
    "Unit Price": {format:currency}
    Revenue: {format:currency}
  }
}

# Summary cells using table reference
cell F12: "Total Product Revenue" {bold}
cell G12: =SUM(Products[Revenue]) {bold, format:currency, bg:#d4edda}

# Python analysis
python at A15 {
  import pandas as pd

  # Get regional data
  regional = q.cells("A4:D9")

  # Calculate insights
  top_region = regional.loc[regional['Revenue'].idxmax(), 'Region']
  avg_growth = regional['Growth'].mean()

  f"Top region: {top_region}, Avg growth: {avg_growth:.1%}"
}
```

---

## Future Features (TODO)

### Conditional Formatting

> **TODO:** Define syntax for conditional formatting rules
>
> Considerations:
> - Color scales (gradient based on value)
> - Data bars
> - Icon sets
> - Rule-based formatting (if value > X, apply format Y)
> - Formula-based conditions
>
> Possible syntax:
> ```
> conditional B2:B100 {
>   rule: value > 1000 {bg:#d4edda, color:#155724}
>   rule: value < 0 {bg:#f8d7da, color:#721c24}
> }
>
> conditional C2:C100 {
>   scale: min=#ff0000, mid=#ffff00, max=#00ff00
> }
> ```

---

### Merged Cells

> **TODO:** Define syntax for merging cells
>
> Considerations:
> - Horizontal merge (span columns)
> - Vertical merge (span rows)
> - Block merge (span both)
>
> Possible syntax:
> ```
> cell A1: "Company Report" {merge:A1:D1, bold, align:center}
>
> # Or separate merge statement
> merge A1:D1
> cell A1: "Company Report" {bold, align:center}
> ```

---

### Data Validations

> **TODO:** Define syntax for cell validation rules
>
> Considerations:
> - Dropdown lists
> - Number ranges (min/max)
> - Date ranges
> - Text length limits
> - Custom formulas
> - Error messages
>
> Possible syntax:
> ```
> validate B2:B100 {
>   type: number
>   min: 0
>   max: 1000000
>   error: "Revenue must be between 0 and 1,000,000"
> }
>
> validate A2:A100 {
>   type: list
>   options: ["North", "South", "East", "West"]
> }
>
> validate C2:C100 {
>   type: date
>   min: 2024-01-01
>   max: 2024-12-31
> }
> ```

---

## Implementation Notes

### Parser Requirements

1. Must handle multi-line code blocks (Python/JavaScript)
2. Must preserve formula syntax exactly (pass through to Quadratic's formula engine)
3. Must resolve table references (`TableName[Column]`) to cell ranges
4. Must track table positions for structured references

### Error Handling

- Invalid cell references should produce clear error messages
- Unknown format properties should warn but not fail
- Overlapping grids/tables should error

### Quadratic Integration Points

- Cell values map to `CellValue` enum in quadratic-core
- Formulas use existing formula parser
- Code cells map to `CodeCell` with appropriate `CodeCellLanguage`
- Formats map to `SheetFormatting` structures

---

## Open Questions

1. **Sheet management:** Should the DSL support multiple sheets? Syntax for sheet references?

2. **Charts:** Should charts be part of v1 or deferred?

3. **Images:** Should embedded images be supported?

4. **Named ranges:** Beyond tables, should arbitrary named ranges be supported?

5. **Comments:** Should cell comments be supported?

6. **Import/export:** Should the DSL support referencing external data sources?

export const FormulaDocs = `# Formula Docs

Formulas in Quadratic are similar to how you'd expect in any spreadsheet. Formulas are relatively referenced by default, with $ notation to support absolute references. 

Work with classic spreadsheet logic - math, references, and point and click manipulation for quick data analysis.

Get started with Formulas the same way as any other spreadsheet - click \`=\` on a cell and get started right away. Formulas are in-line by default. 

You can also optionally use multi-line Formulas for those Formulas that need to be expanded to become readable. 

To open the multi-line editor either use / and select it in the cell type selection menu or use the multi-line editor button from the in-line editor. 

The multi-line editor becomes very useful when Formulas become more difficult to read than the space afforded by the in-line editor. 

Example:

\`\`\`formula
IF( Z0 > 10, 
    IF( Z1 > 10, 
        IF (Z2 > 10, 
            AVERAGE(Z0:Z2), 
            "Invalid Data",
        ),
        "Invalid Data", 
    ),
    "Invalid Data", 
)
\`\`\`

Cells are by default referenced relatively in Quadratic. Use $ notation to do absolute references, similar to what you'd be familiar with in traditional spreadsheets.

For example, to reference cell F12 in a sheet named "Sheet 1" from a sheet named "Sheet 2" use: 

\`\`\`formula
="Sheet 1"!F12
\`\`\`

Range of cells 

To reference cells F12 to F14 in Sheet 1 from Sheet 2, use:

\`\`\`formula
="Sheet 1"!F12:F14
\`\`\`

You can reference entire columns with familiar syntax: 

To reference all values in a single column
\`\`\`formula
=A:A
\`\`\`

To reference all values in multiple columns 
\`\`\`formula
=A:A
\`\`\`

Here are lists of supported formulas by category, DO NOT try to use Formulas not in these lists: 

## Operators
= (equals)
== (equals)
<> (not equals)
!= (not equals)
< (less than)
> (greater than)
<= (less than or equal)
>= (greater than or equal)
+ (addition/concatenation)
- (subtraction/negation)
* (multiplication)
/ (division)

## Math and Trigonometry 
ABS
AVERAGE
AVERAGEIF
COUNT
COUNTA
COUNTBLANK
COUNTIF
COUNTIFS
MAX
MIN
STDEV
SUM
SUMIF
SUMIFS
VAR
ACOS
ACOSH
ACOT
ACOTH
ASIN
ASINH
ATAN
ATAN2
ATANH
COS
COSH
COT
COTH
DEGREES
RADIANS
SIN
SINH
TAN
TANH

## String functions 
ARRAYTOTEXT
CONCAT
CONCATENATE
EXACT
LEFT
NUMBERVALUE

## Logic
AND
FALSE
IF
IFERROR
IFNA
NOT
OR
TRUE
XOR

## Lookup 
INDIRECT
VLOOKUP
XLOOKUP

## Finance
PMT

## Date & Time 
DATE
EDATE
EOMONTH
NOW
TODAY

## Filters
FILTER
`;

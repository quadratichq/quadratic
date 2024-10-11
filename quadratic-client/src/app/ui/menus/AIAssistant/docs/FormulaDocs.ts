export const FormulaDocs = `Note: This is an internal message for context. Do not quote it in your response.\n\n

# Formula Docs

Formulas in Quadratic are similar to how you'd expect in any spreadsheet. Formulas are relatively referenced as seen below. 

Work with classic spreadsheet logic - math, references, and point and click manipulation for quick data analysis.

Get started with Formulas the same way as any other spreadsheet - click \`=\` on a cell and get started right away. Formulas are in-line by default. 

You can also optionally use multi-line Formulas for those Formulas that need to be expanded to become readable. 

To open the multi-line editor either use / and select it in the cell type selection menu or use the multi-line editor button from the in-line editor as showed below. 

The multi-line editor becomes useful when Formulas become more difficult to read than the space afforded by the in-line editor. Example:

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

Cells are by default referenced relatively in Quadratic. Use $ notation to do absolute references, similar to what you'd be familiar with in traditional spreadsheets. Learn more on the Reference cells page.

# Reference cells

Reference data in other cells from your formula

1. Reference an individual cell

To reference an individual cell, use standard spreadsheet notation. The only difference is that Quadratic allows negative axes; for negative notation, append \`n\` to the cell reference.
Cells are, by default, relatively referenced. Use \`$\` notation to use absolute references. 

2. Relative cell reference 

Individual cells and ranges are, by default, referenced relatively. E.g. copy-pasting \`A1\` to the following two rows will produce \`A2\`, and \`A3\` respectively.

To reference a range of cells relatively, use the traditional spreadsheet notation that separates two distinct cells using a semicolon as a delimiter, e.g. \`A1:D3\`

Cells in this notation are referenced relatively, so you can drag out a cell to replicate that formula relatively across your selection. 

3. Absolute cell references

To perform absolute cell references, use standard spreadsheet notation with \`$\`, for example \`$A$1:D3\` - \`A1\` will be copied absolutely and \`D3\` will be copied relatively if you drag to replicate.

4. Reference across sheets

To reference the value from another sheet, use the sheet name in quotations with an \`!\`.

Single cell

To reference cell F12 in a sheet named "Sheet 1" from a sheet named "Sheet 2" use: 

\`\`\`formula
"Sheet 1"!F12
\`\`\`

Range of cells 

To reference cells F12 to F14 in Sheet 1 from Sheet 2, use:

\`\`\`formula
"Sheet 1"!F12:F14
\`\`\`

PreviousGetting startedNextFormulas cheat sheet

Last updated 5 months ago

On this page

Was this helpful?

| Formula Notation | (x, y) coordinate plane equivalent |
| ---------------- | ---------------------------------- |
| \`A0\` | (0,0) |
| \`A1\` | (0,1) |
| \`B1\` | (1,1) |
| \`An1\` | (0,-1) |
| \`nA1\` | (-1,1) |
| \`nAn1\` | (-1,-1) |

* 1. Reference an individual cell
* 2. Relative cell reference
* 3. Absolute cell references
* 4. Reference across sheets
* Single cell
* Range of cells

# Formulas cheat sheet

Using formulas in the spreadsheet.

## 

Navigation

Operators

Math Functions

Trig Functions

Stats Functions

Logic Functions

String Functions

Lookup Functions

Arrays

Criteria

Wildcards

## 

Operators

| Precedence   | Symbol                              | Description              |
| ------------ | ----------------------------------- | ------------------------ |
| 1            | x%                                  | Percent (divides by 100) |
| 2            | +x                                  | positive                 |
| -x           | negative                            |                          |
| 3            | a:b                                 | cell range               |
| 4            | a..b                                | numeric range            |
| 5            | a^b or a**b                         | Exponentiation           |
| 6            | a*b                                 | Multiplication           |
| a/b          | Division                            |                          |
| 7            | a+b                                 | Addition                 |
| a-b          | Subtraction                         |                          |
| 8            | a&b                                 | String concatenation     |
| 9            | a=b or a==b                         | Equal comparison         |
| a<>b or a!=b | Not equal comparison                |                          |
| a<b          | Less than comparison                |                          |
| a>b          | Greater than comparison             |                          |
| a<=b         | Less than or equal to comparison    |                          |
| a>=b         | Greater than or equal to comparison |                          |

## Mathematics functions

| **Function** | **Description** |
| ------------ | --------------- |
| \`SUM([numbers...])\` | Adds all values. Returns \`0\` if given no values. |
| \`SUMIF(eval_range, criteria, [sum_range])\` | Evaluates each value based on some criteria, and then adds the ones that meet those criteria. If \`sum_range\` is given, then values in \`sum_range\` are added instead wherever the corresponding value in \`eval_range\` meets the criteria. See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas. |
| \`SUMIFS(sum_range, eval_range1, criteria1, [more_eval_ranges_and_criteria...])\` | Adds values from \`numbers_range\` wherever the criteria are met at the corresponding value in each \`eval_range\`. See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas. |
| \`PRODUCT([numbers...])\` | Multiplies all values. Returns \`1\` if given no values. |
| \`ABS(number)\` | Returns the absolute value of a number. |
| \`SQRT(number)\` | Returns the square root of a number. |
| \`CEILING(number, increment)\` | Rounds a number up to the next multiple of \`increment\`. If \`number\` and \`increment\` are both negative, rounds the number down away from zero. Returns an error if \`number\` is positive but \`significance\` is negative. Returns \`0\` if \`increment\` is \`0\`. |
| \`FLOOR(number, increment)\` | Rounds a number down to the next multiple of \`increment\`. If \`number\` and \`increment\` are both negative, rounds the number up toward zero. Returns an error if \`number\` is positive but \`significance\` is negative, or if \`increment\` is \`0\` but \`number\` is nonzero. Returns \`0\` if \`increment\` is \`0\` _and_ \`number\` is \`0\`. |
| \`INT(number)\` | Rounds a number down to the next integer. Always rounds toward negative infinity. |
| \`POWER(base, exponent)\` | Returns the result of raising \`base\` to the power of \`exponent\`. |
| \`PI()\` | Returns π, the circle constant. |
| \`TAU()\` | Returns τ, the circle constant equal to 2π. |

### CEILING.MATH

\`\`\`formula
CEILING.MATH(number, [increment], [negative_mode])
\`\`\`

Examples:

\`\`\`formula
CEILING.MATH(6.5)
\`\`\`

\`\`\`formula
CEILING.MATH(6.5, 2)
\`\`\`

\`\`\`formula
CEILING.MATH(-12, 5)
\`\`\`

\`\`\`formula
CEILING.MATH(-12, 5, -1)
\`\`\`

Rounds a number up or away from zero to the next multiple of \`increment\`. If \`increment\` is omitted, it is assumed to be \`1\`. The sign of \`increment\` is ignored.

If \`negative_mode\` is positive or zero, then \`number\` is rounded up, toward positive infinity. If \`negative_mode\` is negative, then \`number\` is rounded away from zero.
These are equivalent when \`number\` is positive, so in this case \`negative_mode\` has no effect.

If \`increment\` is zero, returns zero.

### FLOOR.MATH

\`\`\`formula
FLOOR.MATH(number, [increment], [negative_mode])
\`\`\`

Examples:

\`\`\`formula
FLOOR.MATH(6.5)
\`\`\`

\`\`\`formula
FLOOR.MATH(6.5, 2)
\`\`\`

\`\`\`formula
FLOOR.MATH(-12, 5)
\`\`\`

\`\`\`formula
FLOOR.MATH(-12, 5, -1)
\`\`\`

Rounds a number down or toward zero to the next multiple of \`increment\`. If \`increment\` is omitted, it is assumed to be \`1\`. The sign of \`increment\` is ignored.

If \`negative_mode\` is positive or zero, then \`number\` is rounded down, toward negative infinity. If \`negative_mode\` is negative, then \`number\` is rounded toward zero. These are equivalent when \`number\` is positive, so in this case \`negative_mode\` has no effect.

If \`increment\` is zero, returns zero.

### MOD

\`\`\`formula
MOD(number, divisor)
\`\`\`

Examples:

\`\`\`formula
MOD(3.9, 3)
\`\`\`

\`\`\`formula
MOD(-2.1, 3)
\`\`\`

Returns the remainder after dividing \`number\` by \`divisor\`. The result always has the same sign as \`divisor\`.

Note that \`INT(n / d) * d + MOD(n, d)\` always equals \`n\` (up to floating-point precision).

### EXP

\`\`\`formula
EXP(exponent)
\`\`\`

Examples:

\`\`\`formula
EXP(1), EXP(2/3), EXP(C9)
\`\`\`

Returns the result of raising [Euler's number] _e_ to the power
of \`exponent\`.

[Euler's number]: https://en.wikipedia.org/wiki/E_(mathematical_constant)

### LOG

\`\`\`formula
LOG(number, [base])
\`\`\`

Examples:

\`\`\`formula
LOG(100)
\`\`\`

\`\`\`formula
LOG(144, 12)
\`\`\`

\`\`\`formula
LOG(144, 10)
\`\`\`

Returns the [logarithm] of \`number\` to the base \`base\`. If \`base\` is omitted, it is assumed to be 10, the base of the [common logarithm].

[logarithm]: https://en.wikipedia.org/wiki/Logarithm
[common logarithm]: https://en.wikipedia.org/wiki/Common_logarithm

### LOG10

\`\`\`formula
LOG10(number)
\`\`\`

Examples:

\`\`\`formula
LOG10(100)
\`\`\`

Returns the [base-10 logarithm] of \`number\`.

[base-10 logarithm]:https://en.wikipedia.org/wiki/Common_logarithm

### LN

\`\`\`formula
LN(number)
\`\`\`

Examples:

\`\`\`formula
LN(50)
\`\`\`

Returns the [natural logarithm] of \`number\`. [natural logarithm]:https://en.wikipedia.org/wiki/Natural_logarithm

## Trigonometric functions

| **Function** | **Description** |
| ------------ | --------------- |
| \`DEGREES(radians)\` | Converts radians to degrees. |
| \`RADIANS(degrees)\` | Converts degrees to radians. |
| \`SIN(radians)\` | Returns the [sine](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ASIN(number)\` | Returns the [inverse sine](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from 0 to π. |
| \`COS(radians)\` | Returns the [cosine](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ACOS(number)\` | Returns the [inverse cosine](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from 0 to π. |
| \`TAN(radians)\` | Returns the [tangent](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ATAN(number)\` | Returns the [inverse tangent](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from -π/2 to π/2. |
| \`CSC(radians)\` | Returns the [cosecant](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ACSC(number)\` | Returns the [inverse cosecant](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from -π/2 to π/2. |
| \`SEC(radians)\` | Returns the [secant](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ASEC(number)\` | Returns the [inverse secant](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from 0 to π. |
| \`COT(radians)\` | Returns the [cotangent](https://en.wikipedia.org/wiki/Trigonometric_functions) of an angle in radians. |
| \`ACOT(number)\` | Returns the [inverse cotangent](https://en.wikipedia.org/wiki/Inverse_trigonometric_functions) of a number, in radians, ranging from 0 to π. |
| \`SINH(radians)\` | Returns the [hyperbolic sine](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ASINH(number)\` | Returns the [inverse hyperbolic sine](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |
| \`COSH(radians)\` | Returns the [hyperbolic cosine](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ACOSH(number)\` | Returns the [inverse hyperbolic cosine](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |
| \`TANH(radians)\` | Returns the [hyperbolic tangent](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ATANH(number)\` | Returns the [inverse hyperbolic tangent](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |
| \`CSCH(radians)\` | Returns the [hyperbolic cosecant](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ACSCH(number)\` | Returns the [inverse hyperbolic cosecant](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |
| \`SECH(radians)\` | Returns the [hyperbolic secant](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ASECH(number)\` | Returns the [inverse hyperbolic secant](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |
| \`COTH(radians)\` | Returns the [hyperbolic cotangent](https://en.wikipedia.org/wiki/Hyperbolic_functions) of an angle in radians. |
| \`ACOTH(number)\` | Returns the [inverse hyperbolic cotangent](https://en.wikipedia.org/wiki/Inverse_hyperbolic_functions) of a number, in radians. |

### ATAN2

\`\`\`formula
ATAN2(x, y)
\`\`\`

Examples:

\`\`\`formula
ATAN2(2, 1)
\`\`\`

Returns the counterclockwise angle, in radians, from the X axis to the point \`(x, y)\`. Note that the argument order is reversed compared to the [typical \`atan2()\` function](https://en.wikipedia.org/wiki/Atan2).

If both arguments are zero, returns zero.

## Statistics functions

| **Function** | **Description** |
| ------------ | --------------- |
| \`AVERAGE([numbers...])\` | Returns the arithmetic mean of all values. |
| \`AVERAGEIF(eval_range, criteria, [numbers_range])\` | Evaluates each value based on some criteria, and then computes the arithmetic mean of the ones that meet those criteria. If \`range_to_average\` is given, then values in \`range_to_average\` are averaged instead wherever the corresponding value in \`range_to_evaluate\` meets the criteria. See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas. |
| \`COUNTIF(range, criteria)\` | Evaluates each value based on some criteria, and then counts how many values meet those criteria. See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas. |
| \`COUNTIFS(eval_range1, criteria1, [more_eval_ranges_and_criteria...])\` | Evaluates multiple values on they're respective criteria, and then counts how many sets of values met all their criteria. See [the documentation](https://docs.quadratichq.com/formulas) for more details about how criteria work in formulas. |
| \`MIN([numbers...])\` | Returns the smallest value. Returns +∞ if given no values. |
| \`MAX([numbers...])\` | Returns the largest value. Returns -∞ if given no values. |

### COUNT

\`\`\`formula
COUNT([numbers...])
\`\`\`

Examples:

\`\`\`formula
COUNT(A1:C42, E17)
\`\`\`

\`\`\`formula
SUM(A1:A10) / COUNT(A1:A10)
\`\`\`

Returns the number of numeric values.

- Blank cells are not counted.
- Cells containing an error are not counted.

### COUNTA

\`\`\`formula
COUNTA([range...])
\`\`\`

Examples:

\`\`\`formula
COUNTA(A1:A10)
\`\`\`

Returns the number of non-blank values.

- Cells with formula or code output of an empty string are counted.
- Cells containing zero are counted.
- Cells with an error are counted.

### COUNTBLANK

\`\`\`formula
COUNTBLANK([range...])
\`\`\`

Examples:

\`\`\`formula
COUNTBLANK(A1:A10)
\`\`\`

Counts how many values in the range are empty.

- Cells with formula or code output of an empty string are counted.
- Cells containing zero are not counted.
- Cells with an error are not counted.

## Logic functions

These functions treat \`FALSE\` and \`0\` as "falsey" and all other values are "truthy."

When used as a number, \`TRUE\` is equivalent to \`1\` and \`FALSE\` is equivalent to \`0\`.

| **Function** | **Description** |
| ------------ | --------------- |
| \`TRUE()\` | Returns \`TRUE\`. |
| \`FALSE()\` | Returns \`FALSE\`. |
| \`NOT(boolean)\` | Returns \`TRUE\` if \`a\` is falsey and \`FALSE\` if \`a\` is truthy. |
| \`IF(condition, t, f)\` | Returns \`t\` if \`condition\` is truthy and \`f\` if \`condition\` is falsey. |
| \`IFERROR(value, fallback)\` | Returns \`fallback\` if there was an error computing \`value\`; otherwise returns \`value\`. |

### AND

\`\`\`formula
AND([booleans...])
\`\`\`

Examples:

\`\`\`formula
AND(A1:C1)
\`\`\`

\`\`\`formula
AND(A1, B12)
\`\`\`

Returns \`TRUE\` if all values are truthy and \`FALSE\` if any value is falsey.

Returns \`TRUE\` if given no values.

### OR

\`\`\`formula
OR([booleans...])
\`\`\`

Examples:

\`\`\`formula
OR(A1:C1)
\`\`\`

\`\`\`formula
OR(A1, B12)
\`\`\`

Returns \`TRUE\` if any value is truthy and \`FALSE\` if all values are falsey.

Returns \`FALSE\` if given no values.

### XOR

\`\`\`formula
XOR([booleans...])
\`\`\`

Examples:

\`\`\`formula
XOR(A1:C1)
\`\`\`

\`\`\`formula
XOR(A1, B12)
\`\`\`

Returns \`TRUE\` if an odd number of values are truthy and \`FALSE\` if an even number of values are truthy.

Returns \`FALSE\` if given no values.

## String functions

| **Function** | **Description** |
| ------------ | --------------- |
| \`CONCATENATE([strings...])\` | Same as \`CONCAT\`, but kept for compatibility. |
| \`LEN(s)\` | Returns half the length of the string in [Unicode code-points](https://tonsky.me/blog/unicode/). This is often the same as the number of characters in a string, but not for certain diacritics, emojis, or other cases. |
| \`LENB(s)\` | Returns half the length of the string in bytes, using UTF-8 encoding. |
| \`CODE(s)\` | Same as \`UNICODE\`. Prefer \`UNICODE\`. |
| \`CHAR(code_point)\` | Same as \`UNICHAR\`. Prefer \`UNICHAR\`. |
| \`LOWER(s)\` | Returns the lowercase equivalent of a string. |
| \`UPPER(s)\` | Returns the uppercase equivalent of a string. |
| \`PROPER(s)\` | Capitalizes letters that do not have another letter before them, and lowercases the rest. |
| \`T(v)\` | Returns a string value unmodified, or returns the empty string if passed a value other than a string. |
| \`EXACT(s1, s2)\` | Returns whether two strings are exactly equal, using case-sensitive comparison (but ignoring formatting). |

### ARRAYTOTEXT

\`\`\`formula
ARRAYTOTEXT(array, [format])
\`\`\`

Examples:

\`\`\`formula
ARRAYTOTEXT({"Apple", "banana"; 42, "Hello, world!"})
\`\`\`

\`\`\`formula
ARRAYTOTEXT({"Apple", "banana"; 42, "Hello, world!"}, 1)
\`\`\`

Converts an array of values to a string.

If \`format\` is 0 or omitted, returns a human-readable representation such as \`Apple, banana, 42, hello, world!\`.
If \`format\` is 1, returns a machine-readable representation in valid formula syntax such as \`{"Apple", "banana", 42, "Hello, world!"}\`. If \`format\` is any other value, returns an error.

### CONCAT

\`\`\`formula
CONCAT([strings...])
\`\`\`

Examples:

\`\`\`formula
CONCAT("Hello, ", C0, "!")
\`\`\`

\`\`\`formula
"Hello, " & C0 & "!"
\`\`\`

[Concatenates](https://en.wikipedia.org/wiki/Concatenation) all
values as strings.

\`&\` can also be used to concatenate text.

### LEFT

\`LEFT(s, [char_count])\`

Examples:

\`\`\`formula
LEFT("Hello, world!") = "H"
\`\`\`

\`\`\`formula
LEFT("Hello, world!", 6) = "Hello,"
\`\`\`

\`\`\`formula
LEFT("抱歉，我不懂普通话") = "抱"
\`\`\`

\`\`\`formula
LEFT("抱歉，我不懂普通话", 6) = "抱歉，我不懂"
\`\`\`

Returns the first \`char_count\` characters from the beginning of the string \`s\`.

Returns an error if \`char_count\` is less than 0.

If \`char_count\` is omitted, it is assumed to be 1.

If \`char_count\` is greater than the number of characters in \`s\`, then the entire string is returned.

### LEFTB

\`\`\`formula
LEFTB(s, [byte_count])
\`\`\`

Examples:

\`\`\`formula
LEFTB("Hello, world!") = "H"
\`\`\`

\`\`\`formula
LEFTB("Hello, world!", 6) = "Hello,"
\`\`\`

\`\`\`formula
LEFTB("抱歉，我不懂普通话") = ""
\`\`\`

\`\`\`formula
LEFTB("抱歉，我不懂普通话", 6) = "抱歉"
\`\`\`

\`\`\`formula
LEFTB("抱歉，我不懂普通话", 8) = "抱歉"
\`\`\`

Returns the first \`byte_count\` bytes from the beginning of the string \`s\`, encoded using UTF-8.

Returns an error if \`byte_count\` is less than 0.

If \`byte_count\` is omitted, it is assumed to be 1. If \`byte_count\` is greater than the number of bytes in \`s\`, then the entire string is returned.

If the string would be split in the middle of a character, then \`byte_count\` is rounded down to the previous character boundary so the the returned string takes at most \`byte_count\` bytes.

### RIGHT

\`RIGHT(s, [char_count])\`

Examples:

\`\`\`formula
RIGHT("Hello, world!") = "!"
\`\`\`

\`\`\`formula
RIGHT("Hello, world!", 6) = "world!"
\`\`\`

\`\`\`formula
RIGHT("抱歉，我不懂普通话") = "话"
\`\`\`

\`\`\`formula
RIGHT("抱歉，我不懂普通话", 6) = "我不懂普通话"
\`\`\`

Returns the last \`char_count\` characters from the end of the string \`s\`.

Returns an error if \`char_count\` is less than 0.

If \`char_count\` is omitted, it is assumed to be 1.

If \`char_count\` is greater than the number of characters in \`s\`, then the entire string is returned.

### RIGHTB

\`\`\`formula
RIGHTB(s, [byte_count])
\`\`\`

Examples:

\`\`\`formula
RIGHTB("Hello, world!") = "!"
\`\`\`

\`\`\`formula
RIGHTB("Hello, world!", 6) = "world!"
\`\`\`

\`\`\`formula
RIGHTB("抱歉，我不懂普通话") = ""
\`\`\`

\`\`\`formula
RIGHTB("抱歉，我不懂普通话", 6) = "通话"
\`\`\`

\`\`\`formula
RIGHTB("抱歉，我不懂普通话", 7) = "通话"
\`\`\`

Returns the last \`byte_count\` bytes from the end of the string \`s\`, encoded using UTF-8.

Returns an error if \`byte_count\` is less than 0.

If \`byte_count\` is omitted, it is assumed to be 1.

If \`byte_count\` is greater than the number of bytes in \`s\`, then the entire string is returned.

If the string would be split in the middle of a character, then \`byte_count\` is rounded down to the next character boundary so that the returned string takes at most \`byte_count\` bytes.

### MID

\`\`\`formula
MID(s, start_char, char_count)
\`\`\`

Examples:

\`\`\`formula
MID("Hello, world!", 4, 6) = "lo, wo"
\`\`\`

\`\`\`formula
MID("Hello, world!", 1, 5) = "Hello"
\`\`\`

\`\`\`formula
MID("抱歉，我不懂普通话", 4, 4) = "我不懂普"
\`\`\`

Returns the substring of a string \`s\` starting at the \`start_char\`th character and with a length of \`char_count\`.

Returns an error if \`start_char\` is less than 1 or if \`char_count\` is less than 0.

If \`start_char\` is past the end of the string, returns an empty string. If \`start_char + char_count\` is past the end of the string, returns the rest of the string starting at \`start_char\`.

### MIDB

\`\`\`formula
MIDB(s, start_byte, byte_count)
\`\`\`

Examples:

\`\`\`formula
MIDB("Hello, world!", 4, 6) = "lo, wo"
\`\`\`

\`\`\`formula
MIDB("Hello, world!", 1, 5) = "Hello"
\`\`\`

\`\`\`formula
MIDB("抱歉，我不懂普通话", 10, 12) = "我不懂普"
\`\`\`

\`\`\`formula
MIDB("抱歉，我不懂普通话", 8, 16) = "我不懂普"
\`\`\`

Returns the substring of a string \`s\` starting at the \`start_byte\`th byte and with a length of \`byte_count\` bytes, encoded using UTF-8.

Returns an error if \`start_byte\` is less than 1 or if \`byte_count\` is less than 0.

If \`start_byte\` is past the end of the string, returns an empty string. If \`start_byte + byte_count\` is past the end of the string, returns the rest of the string starting at \`start_byte\`.

If the string would be split in the middle of a character, then \`start_byte\` is rounded up to the next character boundary and \`byte_count\` is rounded down to the previous character boundary so that the returned string takes at most \`byte_count\` bytes.

### UNICODE

\`\`\`formula
UNICODE(s)
\`\`\`

Examples:

\`\`\`formula
UNICODE("a")=97
\`\`\`

\`\`\`formula
UNICODE("Alpha")=65
\`\`\`

Returns the first [Unicode] code point in a string as a number. If the first character is part of standard (non-extended) [ASCII], then this is the same as its ASCII number.

[Unicode]: https://en.wikipedia.org/wiki/Unicode
[ASCII]: https://en.wikipedia.org/wiki/ASCII

### UNICHAR

\`\`\`formula
UNICHAR(code_point)
\`\`\`

Examples:

\`\`\`formula
UNICHAR(97) = "a"
\`\`\`

\`\`\`formula
UNICHAR(65) = "A"
\`\`\`

Returns a string containing the given [Unicode] code unit. For numbers in the range 0-127, this converts from a number to its corresponding [ASCII] character.

[Unicode]: https://en.wikipedia.org/wiki/Unicode
[ASCII]: https://en.wikipedia.org/wiki/ASCII

### CLEAN

\`\`\`formula
CLEAN(s)
\`\`\`

Examples:

\`\`\`formula
CLEAN(CHAR(9) & "(only the parenthetical will survive)" & CHAR(10))
\`\`\`

Removes nonprintable [ASCII] characters 0-31 (0x00-0x1F) from a string. This removes tabs and newlines, but not spaces.

[ASCII]: https://en.wikipedia.org/wiki/ASCII

### TRIM

\`\`\`formula
TRIM(s)
\`\`\`

Examples:

\`\`\`formula
TRIM("    a    b    c    ")="a b c"
\`\`\`

Removes spaces from the beginning and end of a string \`s\`, and replaces each run of consecutive space within the string with a single space.

[Other forms of whitespace][whitespace], including tabs and newlines, are preserved.

[whitespace]: https://en.wikipedia.org/wiki/Whitespace_character

### NUMBERVALUE

\`\`\`formula
NUMBERVALUE(s, [decimal_sep], [group_sep])
\`\`\`

Examples:

\`\`\`formula
NUMBERVALUE("4,000,096.25")
\`\`\`

\`\`\`formula
NUMBERVALUE("4.000.096,25")
\`\`\`

Parses a number from a string \`s\`, using \`decimal_sep\` as the decimal separator and \`group_sep\` as the group separator.

If \`decimal_sep\` is omitted, it is assumed to be \`.\`. If \`group_sep\` is omitted, it is assumed to be \`,\`. Only the first character of each is considered.
If the decimal separator and the group separator are the same or if either is an empty string, an error is returned.

The decimal separator must appear at most once in the string. The group separator must not appear at any point after a decimal separator.
Whitespace may appear anywhere in the string.Whitespace and group separators are ignored and have no effect on the returned number.

## Lookup functions

| **Function** | **Description** |
| ------------ | --------------- |
| \`INDIRECT(cellref_string)\` | Returns the value of the cell at a given location. |

### VLOOKUP

\`\`\`formula
VLOOKUP(search_key, search_range, output_col, [is_sorted])
\`\`\`

Examples:

\`\`\`formula
VLOOKUP(17, A1:C10, 3)
\`\`\`

\`\`\`formula
VLOOKUP(17, A1:C10, 2, FALSE)
\`\`\`

Searches for a value in the first vertical column of a range and return the corresponding cell in another vertical column, or an error if no match is found.

If \`is_sorted\` is \`TRUE\`, this function uses a [binary search algorithm](https://en.wikipedia.org/wiki/Binary_search_algorithm), so the first column of \`search_range\` must be sorted,
with smaller values at the top and larger values at the bottom; otherwise the result of this function will be meaningless. If \`is_sorted\` is omitted, it is assumed to be \`false\`.

If any of \`search_key\`, \`output_col\`, or \`is_sorted\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements.

### HLOOKUP

\`\`\`formula
HLOOKUP(search_key, search_range, output_row, [is_sorted])
\`\`\`

Examples:

\`\`\`formula
HLOOKUP(17, A1:Z3, 3)
\`\`\`

\`\`\`formula
HLOOKUP(17, A1:Z3, 2, FALSE)
\`\`\`

Searches for a value in the first horizontal row of a range and return the corresponding cell in another horizontal row, or an error if no match is found.

If \`is_sorted\` is \`TRUE\`, this function uses a [binary search algorithm](https://en.wikipedia.org/wiki/Binary_search_algorithm), so the first row of \`search_range\` must be sorted,
with smaller values at the left and larger values at the right; otherwise the result of this function will be meaningless. If \`is_sorted\` is omitted, it is assumed to be \`false\`.

If any of \`search_key\`, \`output_col\`, or \`is_sorted\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements.

### XLOOKUP

\`\`\`formula
XLOOKUP(search_key, search_range, output_range, [fallback], [match_mode], [search_mode])
\`\`\`

Examples:

\`\`\`formula
XLOOKUP("zebra", A1:Z1, A4:Z6)
\`\`\`

\`\`\`formula
XLOOKUP({"zebra"; "aardvark"}, A1:Z1, A4:Z6)
\`\`\`

\`\`\`formula
XLOOKUP(50, C4:C834, B4:C834, {-1, 0, "not found"}, -1, 2)
\`\`\`

Searches for a value in a linear range and returns a row or column from another range.

\`search_range\` must be either a single row or a single column.

#### Match modes

There are four match modes:

- 0 = exact match (default)
- -1 = next smaller
- 1 = next larger
- 2 = wildcard

See [the documentation](https://docs.quadratichq.com/formulas#31e708d41a1a497f8677ff01dddff38b) for more details about how wildcards work in formulas.

#### Search modes

There are four search modes:

- 1 = linear search (default)
- -1 = reverse linear search
- 2 = [binary search](https://en.wikipedia.org/wiki/Binary_search_algorithm)
- -2 = reverse binary search

Linear search finds the first matching value, while reverse linear search finds the last matching value.

Binary search may be faster than linear search, but binary search requires that values are sorted, with smaller values at the top or left and larger values at the bottom or right.
Reverse binary search requires that values are sorted in the opposite direction. If \`search_range\` is not sorted, then the result of this function will be meaningless.

Binary search is not compatible with the wildcard match mode.

#### Result

If \`search_range\` is a row, then it must have the same width as \`output_range\` so that each value in \`search_range\` corresponds to a column in \`output_range\`. In this case, the **search axis** is vertical.

If \`search_range\` is a column, then it must have the same height as \`output_range\` so that each value in \`search_range\` corresponds to a row in \`output_range\`. In this case, the **search axis** is horizontal.

If a match is not found, then \`fallback\` is returned instead. If there is no match and \`fallback\` is omitted, then returns an error.

If any of \`search_key\`, \`fallback\`, \`match_mode\`, or \`search_mode\` is an array, then they must be compatible sizes and a lookup will be performed for each corresponding set of elements.
These arrays must also have compatible size with the non-search axis of \`output_range\`.

### MATCH

\`\`\`formula
MATCH(search_key, search_range, [match_mode])
\`\`\`

Examples:

\`\`\`formula
MATCH(12, {10, 20, 30})
\`\`\`

\`\`\`formula
MATCH(19, {10, 20, 30}, -1)
\`\`\`

\`\`\`formula
MATCH("A", {"a"; "b"; "c"}, 0)
\`\`\`

Searches for a value in a range and returns the index of the first match, starting from 1.

If \`match_mode\` is \`1\` (the default), then the index of the _greatest value less than_ \`search_key\` will be returned. In
this mode, \`search_range\` must be sorted in ascending order, with smaller values at the top or left and larger values at the bottom or right; otherwise the result of this function will be meaningless.

If \`match_mode\` is \`-1\`, then the index of the _smallest value greater than_ \`search_key\` will be returned.
In this mode, \`search_range\` must be sorted in ascending order, with larger values at the top or left and smaller values at the bottom or right; otherwise the result of this function will be meaningless.

If \`match_mode\` is \`0\`, then the index of the first value _equal_ to \`search_key\` will be returned. In this mode, \`search_range\` may be in any order. \`search_key\` may also be a wildcard.

See [the documentation](https://docs.quadratichq.com/formulas#31e708d41a1a497f8677ff01dddff38b) for more details about how wildcards work in formulas.

### INDEX

\`\`\`formula
INDEX(range, [row], [column], [range_num])
\`\`\`

Examples:

\`\`\`formula
INDEX({1, 2, 3; 4, 5, 6}, 1, 3)
\`\`\`

\`\`\`formula
INDEX(A1:A100, 42)
\`\`\`

\`\`\`formula
INDEX(A6:Q6, 12)
\`\`\`

\`\`\`formula
INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6)
\`\`\`

\`\`\`formula
E1:INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6)
\`\`\`

\`\`\`formula
INDEX((A1:B6, C1:D6, D1:D100), 1, 5, C6):E1
\`\`\`

\`\`\`formula
INDEX(A3:Q3, A2):INDEX(A6:Q6, A2)
\`\`\`

Returns the element in \`range\` at a given \`row\` and \`column\`. If the array is a single row, then \`row\` may be omitted; otherwise it is required.
If the array is a single column, then \`column\` may be omitted; otherwise it is required.

If \`range\` is a group of multiple range references, then the extra parameter \`range_num\` indicates which range to index from.

When \`range\` is a range references or a group of range references, \`INDEX\` may be used as part of a new range reference.

## Arrays

An array can be written using \`{}\`, with \`,\` between values within a row and \`;\` between rows. For example, \`{1, 2, 3; 4, 5, 6}\` is an array with two rows and three columns:

| 1 | 2 | 3 |
| - | - | - |
| 4 | 5 | 6 |

Arrays cannot be empty and every row must be the same length.

Numeric ranges (such as \`1..10\`) and cell ranges (such as \`A1:A10\`) also produce arrays. All operators and most functions can operate on arrays, following these rules:

1. Operators always operate element-wise. For example, \`{1, 2, 3} + {10, 20, 30}\` produces \`{11, 22, 33}\`.
2. Functions that take a fixed number of values operate element-wise. For example, \`NOT({TRUE, TRUE, FALSE})\` produces \`{FALSE, FALSE, TRUE}\`.
3. Functions that can take any number of values expand the array into individual values. For example, \`SUM({1, 2, 3})\` is the same as \`SUM(1, 2, 3)\`.

When arrays are used element-wise, they must be the same size. For example, \`{1, 2} + {10, 20, 30}\` produces an error.

When an array is used element-wise with a single value, the value is expanded into an array of the same size. For example, \`{1, 2, 3} + 10\` produces \`{11, 12, 13}\`.

## Criteria

Some functions, such as \`SUMIF()\`, take a **criteria** parameter that other values are compared to. A criteria value can be a literal value, such as \`1\`, \`FALSE\`, \`"blue"\`, etc. A literal value checks for equality (case-insensitive). However, starting a string with a comparison operator enables more complex criteria:

| **Symbol**           | **Description**                  |
| -------------------- | -------------------------------- |
| "=blue" or "==blue"  | Equal comparison                 |
| "<>blue" or "!=blue" | Not-equal comparison             |
| "<blue"              | Less-than comparison             |
| ">blue"              | Greater-than comparison          |
| "<=blue"             | Less-than-or-equal comparison    |
| ">=blue"             | Greater-than-or-equal comparison |

For example, \`COUNTIF(A1:A10, ">=3")\` counts all values greater than or equal to three, and \`COUNTIF(A1:A10, "<>blue")\` counts all values _not_ equal to the text \`"blue"\` (excluding quotes).

Numbers and booleans are compared by value (with \`TRUE\`=1 and \`FALSE\`=0), while strings are compared case-insensitive lexicographically. For example, \`"aardvark"\` is less than \`"Camel"\` which is less than \`"zebra"\`.\`"blue"\` and \`"BLUE"\` are considered equal.

## Wildcards

Wildcard patterns can be used …

* … When using a criteria parameter with an equality-based comparison (\`=\`, \`==\`, \`<>\`, \`!=\`, or no operator)
* … When using the \`XLOOKUP\` function with a \`match_mode\` of \`2\` (wildcard)

In wildcards, the special symbols \`?\` and \`*\` can be used to match certain text patterns: \`?\` matches any single character and \`*\` matches any sequence of zero or more characters. For example, \`DEFEN?E\` matches the strings \`"defence"\` and \`"defense"\` but not \`"defenestrate"\`. \`*ATE\` matches the strings \`"ate"\`,\`"inflate"\`,\`"late"\` but not \`"wait"\`. Multiple \`?\` and \`*\` are also allowed.

To match a literal \`?\` or \`*\`, prefix it with a tilde \`~\`: for example, \`COUNTIF(A1:A10, "HELLO~?")\` matches only the string \`"Hello?"\` (and uppercase/lowercase variants).

To match a literal tilde \`~\` in a string with \`?\` or \`*\`, replace it with a double tilde \`~~\`. For example, \`COUNTIF(A1:A10, "HELLO ~~?")\` matches the strings \`"hello ~Q"\`,\`"hello ~R"\` etc. If the string does not contain any \`?\` or \`*\`, then tildes do not need to be escaped.
`;

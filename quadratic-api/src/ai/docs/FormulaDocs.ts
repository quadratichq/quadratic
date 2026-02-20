export const FormulaDocs = `# Formula Docs

Formulas in Quadratic work the same as in any traditional spreadsheet. 

## Formula references 
Formulas are relatively referenced by default, with $ notation to support absolute references. 

Formulas can reference data both in and out of tables using standard A1 notation. 

### Formula reference examples 

=SUM(A1:A10)
=SUM(Table1[Column 1])
=SUM(Sheet1!A1:A10)
=SUM(Sheet1!Table1[Column 1])

## STOCKHISTORY

Retrieves historical data about a financial instrument and returns it as an array. This function is compatible with Excel's STOCKHISTORY function.

### Syntax
STOCKHISTORY(stock, start_date, [end_date], [interval], [headers], [property0], [property1], [property2], [property3], [property4], [property5])

### Arguments
- stock: Stock ticker symbol (e.g., "AAPL", "MSFT")
- start_date: The earliest date for which data is retrieved
- end_date: (Optional) The latest date for which data is retrieved. Defaults to start_date.
- interval: (Optional) Data interval: 0 = daily (default), 1 = weekly, 2 = monthly
- headers: (Optional) Header display: 0 = no headers, 1 = show headers (default), 2 = show identifier and headers
- property0-5: (Optional) Columns to retrieve: 0 = Date, 1 = Close, 2 = Open, 3 = High, 4 = Low, 5 = Volume. Default is Date and Close.

### Examples
=STOCKHISTORY("AAPL", "2025-01-01")
=STOCKHISTORY("AAPL", "2025-01-01", "2025-01-31", 0, 1, 0, 1, 2, 3, 4, 5)
`;

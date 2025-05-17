export const ConnectionDocs = `# Connections Docs

You can both read from and write to your databases from Quadratic. Reads are returned directly to the spreadsheet.

You cannot do two queries at once in SQL in Quadratic. For example, you cannot create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

There are some slight differences between SQL syntax across databases to keep in mind: 
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
`;

export const ConnectionDocs = `# Connections Docs

Use SQL to create live connections from your spreadsheets to your databases and data warehouses. 

Once established, you have a live connection that can be rerun, refreshed, read from, and written to your SQL database. 

You can both read and write to your databases from Quadratic. 

Once your connection has been made you can use your connection directly in the sheet. Open the code cell selection menu with \`/\` and select your database from the list.

You can now query your database from your newly opened SQL code editor. You can view the schema or open the AI assistant in the bottom.

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

There are some slight differences between SQL syntax across databases to keep in mind: 
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
`;

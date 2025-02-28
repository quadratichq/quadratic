export const ConnectionDocs = `# Connections Docs

Use SQL to create live connections from your spreadsheets to your databases and data warehouses. 

Once established, you have a live connection that can be rerun, refreshed, read from, and written to your SQL database. 

You can both read and write to your databases from Quadratic. 

Once your connection has been made you can use your connection directly in the sheet. Open the code cell selection menu with \`/\` and select your database from the list.

You can now query your database from your newly opened SQL code editor. You can view the schema or open the AI assistant in the bottom.

The results of your SQL queries are returned to the sheet, with column 0, row 0 anchored to the cell location. 

Query all data from a database table into the spreadsheet

\`\`\`sql
SELECT * FROM table_name
\`\`\`

Query a limited selection (100 rows) from a single table into the spreadsheet 

\`\`\`sql
SELECT * FROM table_name 
LIMIT 100
\`\`\`

Query specific columns from a single table into the spreadsheet 

\`\`\`sql
SELECT column_name1, column_name2 
FROM table_name 
LIMIT 100
\`\`\`

Query all unique values in a column 

\`\`\`sql
SELECT DISTINCT column_name1 
FROM table_name 
LIMIT 100
\`\`\` 

Query data conditionally

\`\`\`sql
-- selects 3 specific columns from a table where column1 equals some value
SELECT column1, column2, column3
FROM table_name
WHERE column1 = 'some_value';
\`\`\`

\`\`\`sql
-- selects 3 specific columns from a table where column1 equals some value and column2 equals some value 
SELECT column1, column2, column3
FROM table_name
WHERE column1 = 'some_value' AND column2 = 5;
\`\`\`

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

There are some slight differences between SQL syntax across databases to keep in mind: 
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
`;

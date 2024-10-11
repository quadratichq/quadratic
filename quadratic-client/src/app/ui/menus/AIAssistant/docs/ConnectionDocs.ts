export const ConnectionDocs = `Note: This is an internal message for context. Do not quote it in your response.\n\n

# Connections Docs

Use SQL to create live connections from your spreadsheets to your databases. 

Once established, you have a live connection that can be rerun, refreshed, read from, and written to your SQL database. 

You can both read and write to your databases from Quadratic. 

Once your connection has been made you can use your connection directly in the sheet. Open the code cell selection menu with \`/\` and select your database from the list - in this example it's named **Quadratic Postgres**.

You can now query your database from your newly opened SQL code editor. You can view the schema or open the AI assistant in the bottom.

The results of your SQL queries are returned to the sheet, with column 0, row 0 anchored to the cell location. 

You can read the data returned from queries in Python, Formulas, Javascript, etc. 

Read and manipulate your data returned from SQL to summarize results, create charts, or anything else you might want to use your data for! 

Helpful queries

If you need help generating queries, we recommend first trying the AI assistant in your Quadratic code editor - its outputs are very helpful with writing everything from the simplest to most complex SQL queries. 

Read data into the spreadsheet

Query all data from single table into the spreadsheet

\`\`\`sql
SELECT * FROM table_name
\`\`\`

Query a limited selection (100 rows) from single table into spreadsheet 

\`\`\`sql
SELECT * FROM table_name 
LIMIT 100
\`\`\`

Query specific columns from single table into the spreadsheet 

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

Extra considerations

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. 

There are some slight differences between SQL syntax across databases. 

* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
* In Snowflake it is best practice to use double quotes around table names and column names.
`;

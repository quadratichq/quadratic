export const ConnectionDocs = `# Connections Docs

Use SQL to create connections from spreadsheets to databases and data warehouses.

You can read from databases in Quadratic. The data read from a SQL cell is directly written to the sheet as a code table.

IMPORTANT: DO NOT under any circumstances perform SQL queries that write to the database unless a user asks for it; only perform reads by default.

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

## SQL syntax

There are some slight differences between SQL syntax across databases to keep in mind:
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
* BIGQUERY uses Standard SQL with nested and repeated fields, requiring backticks for table references and GoogleSQL functions for analytics\n
* COCKROACHDB, SUPABASE and NEON have the same syntax as POSTGRES
* MARIADB has the same syntax as MySQL

## SQL references

You can create parametrized SQL queries that reference sheet data by using {{}} notation.

### Example

Parametrized queries in SQL can only read single cells from the file. They can only be read using A1 notation.

\`\`\`sql
SELECT * FROM {{A1}} WHERE {{column_name}} = {{Sheet2!B7}}
\`\`\`
`;

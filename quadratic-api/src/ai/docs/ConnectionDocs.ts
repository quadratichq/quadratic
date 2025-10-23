export const ConnectionDocs = `# Connections Docs

Use SQL to create connections from spreadsheets to databases and data warehouses.

You can read from databases in Quadratic. The data read from a SQL cell is directly written to the sheet as a code table.

IMPORTANT: DO NOT under any circumstance perform SQL queries that write to the database unless a user asks for it; only perform reads by default.

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

## SQL syntax

There are some slight differences between SQL syntax across databases to keep in mind:
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
* In Snowflake it is best practice to use double quotes around table names and column names.
* BIGQUERY uses Standard SQL with nested and repeated fields, requiring backticks for table references and GoogleSQL functions for analytics\n
* COCKROACHDB, SUPABASE and NEON have the same syntax as POSTGRES
* MARIADB has the same syntax as MySQL

In PostgreSQL, identifiers like table names and column names that contain spaces or are reserved keywords need to be enclosed in double quotes.

## SQL references

You can create parametrized SQL queries that reference sheet data by using {{}} notation. This may include one cell, or a 1d range of cells. For example, if you want to reference the cell A1, you would use {{A1}}. If you want to reference the cells A1:A5, you would use {{A1:A5}}.

Note, this will add the naked values of the cells to the query. It will not place quotation marks around those values. So if the SQL query needs quotation marks, you will need to add them yourself (e.g., '{{A1}}').

You may also reference table columns using the A1 table column reference, eg, {{Table1[Column name]}}. When referencing a table column, Quadratic will insert the values as a comma-delimited list (e.g., 123,456,789). Your SQL query must account for this format.

IMPORTANT: Since Quadratic inserts raw comma-delimited values without quotes, this works well for numeric values with the IN clause. For string values, you'll need to use database-specific functions:
- MySQL/MariaDB: FIND_IN_SET()
- PostgreSQL/CockroachDB/Supabase/Neon: string_to_array() with = ANY or UNNEST
- MS SQL Server: STRING_SPLIT()
- BigQuery: SPLIT() with UNNEST
- Snowflake: SPLIT() with ARRAY_CONTAINS or IN with TABLE(FLATTEN())

If you're working with a connection type not listed above, you'll need to research how that specific database handles comma-delimited string values in SQL queries. Look for string splitting or array functions that can convert the naked comma-delimited list into a format that can be used with IN clauses or comparison operators.

### Examples

#### Single Cell References

Parametrized queries in SQL can read single cells from the file. They can only be read using A1 notation.

\`\`\`sql
SELECT * FROM {{A1}} WHERE {{column_name}} = {{Sheet2!B7}}
\`\`\`

#### MySQL Examples

\`\`\`mysql
-- For numeric values, use IN clause
SELECT * FROM \`users\` WHERE \`user_id\` IN ({{Table1[User ID]}})

-- For string values, use FIND_IN_SET (searches if column value exists in the comma-delimited list)
SELECT * FROM \`users\` WHERE FIND_IN_SET(\`email\`, '{{Table1[Email]}}') > 0
\`\`\`

#### PostgreSQL Examples (also applies to CockroachDB, Supabase, Neon)

\`\`\`sql
-- For numeric values, use IN clause
SELECT * FROM "users" WHERE "user_id" IN ({{Table1[User ID]}})

-- For string values, use = ANY with string_to_array
SELECT * FROM "users" WHERE "email" = ANY(string_to_array('{{Table1[Email]}}', ','))

-- Alternative for strings: use IN with UNNEST
SELECT * FROM "users" WHERE "email" IN (SELECT unnest(string_to_array('{{Table1[Email]}}', ',')))
\`\`\`

#### MS SQL Server Examples

\`\`\`sql
-- For numeric values, use IN clause
SELECT * FROM "users" WHERE "user_id" IN ({{Table1[User ID]}})

-- For string values, use STRING_SPLIT (SQL Server 2016+)
SELECT * FROM "users" WHERE "email" IN (SELECT value FROM STRING_SPLIT('{{Table1[Email]}}', ','))
\`\`\`

#### BigQuery Examples

\`\`\`sql
-- For numeric values, use IN clause
SELECT * FROM \`project.dataset.users\` WHERE \`user_id\` IN ({{Table1[User ID]}})

-- For string values, use SPLIT
SELECT * FROM \`project.dataset.users\` WHERE \`email\` IN UNNEST(SPLIT('{{Table1[Email]}}', ','))
\`\`\`

#### Snowflake Examples

\`\`\`sql
-- For numeric values, use IN clause
SELECT * FROM "users" WHERE "user_id" IN ({{Table1[User ID]}})

-- For string values, use ARRAY_CONTAINS with SPLIT
SELECT * FROM "users" WHERE ARRAY_CONTAINS("email"::VARIANT, SPLIT('{{Table1[Email]}}', ','))

-- Alternative for strings: use IN with TABLE(FLATTEN())
SELECT * FROM "users" WHERE "email" IN (SELECT value::STRING FROM TABLE(FLATTEN(SPLIT('{{Table1[Email]}}', ','))))
\`\`\`

## Getting Schema from Database

Use the get_database_schemas tool to get the schema of a database.
`;

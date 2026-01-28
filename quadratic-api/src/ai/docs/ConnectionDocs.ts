export const ConnectionDocs = `# Connections Docs

Use SQL to create connections from spreadsheets to databases and data warehouses.

You can read from databases in Quadratic. The data read from a SQL cell is directly written to the sheet as a code table.

IMPORTANT: DO NOT under any circumstance perform SQL queries that write to the database unless a user asks for it; only perform reads by default.

You cannot do two queries at once in SQL in Quadratic. For example, you can not create a table and then query that table in the same SQL query. You'll want to generate two distinct code blocks if two queries are involved. Or 3 code blocks if three queries are involved, etc.

## Connection Types

Quadratic supports two categories of SQL connections:

### Native Database Connections
These connections query databases directly using their native SQL dialect:
* **PostgreSQL** (and derivatives: CockroachDB, Supabase, Neon)
* **MySQL** (and MariaDB)
* **MS SQL Server**
* **Snowflake**
* **BigQuery**

### DataFusion Connections (Synced Data)
These connections use Apache DataFusion to query synced/cached data stored as Parquet files:
* **Mixpanel**
* **Google Analytics**
* **Plaid**

DataFusion connections are **read-only** and do not support CREATE, ALTER, DROP, or INSERT statements.

## SQL syntax

There are some slight differences between SQL syntax across databases to keep in mind:
* In Postgres it is best practice use quotes around table names and column names.
* In MySQL it is best practice to use backticks around table names and column names.
* In MS SQL Server it is best practice to use double quotes around table names and column names.
* In Snowflake it is best practice to use double quotes around table names and column names.
* BIGQUERY uses Standard SQL with nested and repeated fields, requiring backticks for table references and GoogleSQL functions for analytics.
* COCKROACHDB, SUPABASE and NEON have the same syntax as POSTGRES.
* MARIADB has the same syntax as MySQL.

## DataFusion SQL (Mixpanel, Google Analytics, Plaid)

DataFusion connections use Apache DataFusion's SQL dialect, which is similar to PostgreSQL but has some key differences:

### Case Sensitivity
* Column names are converted to lowercase by default.
* To query columns with capital letters, you MUST use double quotes: \`SELECT "columnName" FROM table\`
* Table names are also case-sensitive when quoted.

### Supported Features
* Standard SQL: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET
* All JOIN types: INNER, LEFT/RIGHT/FULL OUTER, CROSS, NATURAL, and SEMI/ANTI joins
* Window functions with OVER clause
* Common Table Expressions (CTEs) with WITH clause
* Subqueries in SELECT, FROM, and WHERE clauses
* UNION, INTERSECT, EXCEPT operations
* QUALIFY clause (filters window function results, similar to HAVING for aggregates)

### Common Functions
* **Aggregates:** COUNT, SUM, AVG, MIN, MAX, MEDIAN, array_agg, string_agg
* **String:** concat, upper, lower, trim, substring, length, replace, split_part
* **Date/Time:** now(), date_trunc, date_part, extract, to_timestamp, to_timestamp_nanos
* **Math:** abs, round, ceil, floor, power, sqrt, log, ln
* **Null handling:** coalesce, nullif, nvl

### Not Supported in DataFusion
* JSON operators (->, ->>)
* PostgreSQL-specific type casting syntax (::type) - use CAST(x AS type) instead
* Database modification (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP)
* Stored procedures or user-defined functions
* FROM_UNIXTIME() - this common function does not exist in DataFusion
* Some PostgreSQL-specific functions may not be available

### Converting Unix Timestamps (Critical!)
DataFusion's timestamp functions are **misleadingly named** and do NOT work as their names suggest. This is a major documentation gap:

| Function | What the name suggests | What it actually expects |
|----------|----------------------|-------------------------|
| to_timestamp_seconds() | Unix timestamp in seconds | A date STRING like "2025-08-01" |
| to_timestamp_millis() | Unix timestamp in milliseconds | A date STRING |
| to_timestamp_nanos() | Unix timestamp in nanoseconds | **Actually works with BIGINT!** ✓ |

**DO NOT use to_timestamp_seconds() or to_timestamp_millis() with Unix timestamps** - they will produce incorrect 1970 dates.

**The reliable solution:** Always use \`to_timestamp_nanos()\` and convert your timestamps to nanoseconds:

\`\`\`sql
-- For Unix timestamps in SECONDS (e.g., 1704067200):
-- Multiply by 1,000,000,000 to convert to nanoseconds
to_timestamp_nanos(CAST("unixSeconds" AS BIGINT) * 1000000000)

-- For Unix timestamps in MILLISECONDS (e.g., 1704067200000):
-- Multiply by 1,000,000 to convert to nanoseconds
to_timestamp_nanos(CAST("unixMillis" AS BIGINT) * 1000000)

-- For Unix timestamps already in NANOSECONDS:
to_timestamp_nanos(CAST("unixNanos" AS BIGINT))
\`\`\`

**Other timestamp functions:**
* **TO_TIMESTAMP()** expects a STRING input, not an integer (e.g., \`TO_TIMESTAMP('2025-01-01 12:00:00')\`)
* **No FROM_UNIXTIME()** - this common function does not exist in DataFusion

### DataFusion Examples

\`\`\`sql
-- Basic query with case-sensitive column
SELECT "eventName", COUNT(*) as event_count
FROM events
GROUP BY "eventName"
ORDER BY event_count DESC
LIMIT 10
\`\`\`

\`\`\`sql
-- Using window functions
SELECT 
  "userId",
  "eventTime",
  ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "eventTime") as event_sequence
FROM events
\`\`\`

\`\`\`sql
-- Date filtering (use CAST instead of ::)
SELECT * FROM events
WHERE CAST("eventTime" AS DATE) >= '2024-01-01'
\`\`\`

\`\`\`sql
-- Converting Unix timestamp (milliseconds) to readable timestamp
-- IMPORTANT: Use to_timestamp_nanos() with conversion, NOT to_timestamp_millis()
SELECT 
  "event",
  to_timestamp_nanos(CAST("mp_processing_time_ms" AS BIGINT) * 1000000) as event_time,
  date_trunc('day', to_timestamp_nanos(CAST("mp_processing_time_ms" AS BIGINT) * 1000000)) as event_date
FROM events
WHERE to_timestamp_nanos(CAST("mp_processing_time_ms" AS BIGINT) * 1000000) >= '2024-01-01'
\`\`\`

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
- DataFusion (Mixpanel/Google Analytics/Plaid): string_to_array() with IN or array_has()

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

#### DataFusion Examples (Mixpanel, Google Analytics, Plaid)

\`\`\`sql
-- For numeric values, use IN clause
SELECT * FROM events WHERE "userId" IN ({{Table1[User ID]}})

-- For string values, use array_has with make_array or string_to_array
SELECT * FROM events WHERE array_has(string_to_array('{{Table1[Email]}}', ','), "email")
\`\`\`

## Getting Schema from Database

Use the get_database_schemas tool to get the schema of a database.
`;

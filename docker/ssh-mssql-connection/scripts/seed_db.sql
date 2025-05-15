use AllTypes

-- Drop the table if it exists
IF OBJECT_ID('dbo.all_native_data_types', 'U') IS NOT NULL
    DROP TABLE dbo.all_native_data_types;

-- Create the table with all SQL Server data types
CREATE TABLE dbo.all_native_data_types (
    id INT IDENTITY(1,1) PRIMARY KEY,
    
    -- Exact numerics
    tinyint_col TINYINT,
    smallint_col SMALLINT,
    int_col INT,
    bigint_col BIGINT,
    bit_col BIT,
    decimal_col DECIMAL(10,2),
    numeric_col NUMERIC(10,2),
    money_col MONEY,
    smallmoney_col SMALLMONEY,
    
    -- Approximate numerics
    float_col FLOAT,
    real_col REAL,
    
    -- Date and time
    date_col DATE,
    time_col TIME(7),
    datetime2_col DATETIME2(7),
    datetimeoffset_col DATETIMEOFFSET(7),
    datetime_col DATETIME,
    smalldatetime_col SMALLDATETIME,
    
    -- Character strings
    char_col CHAR(10),
    varchar_col VARCHAR(255),
    text_col TEXT,
    
    -- Unicode character strings
    nchar_col NCHAR(10),
    nvarchar_col NVARCHAR(255),
    ntext_col NTEXT,
    
    -- Binary strings
    binary_col BINARY(10),
    varbinary_col VARBINARY(255),
    image_col IMAGE,
    
    -- Other data types
    -- geography_col GEOGRAPHY,                                           -- not supported in tiberius
    -- geometry_col GEOMETRY,                                             -- not supported in tiberius
    -- hierarchyid_col HIERARCHYID,                                       -- not supported in tiberius
    json_col NVARCHAR(MAX), -- Used to store JSON data
    -- sql_variant_col SQL_VARIANT,                                       -- not supported in tiberius
    uniqueidentifier_col UNIQUEIDENTIFIER,
    xml_col XML,
    
    -- Large value data types
    varchar_max_col VARCHAR(MAX),
    nvarchar_max_col NVARCHAR(MAX),
    varbinary_max_col VARBINARY(MAX)
);

-- Insert sample data
INSERT INTO dbo.all_native_data_types (
    tinyint_col,
    smallint_col,
    int_col,
    bigint_col,
    bit_col,
    decimal_col,
    numeric_col,
    money_col,
    smallmoney_col,
    float_col,
    real_col,
    date_col,
    time_col,
    datetime2_col,
    datetimeoffset_col,
    datetime_col,
    smalldatetime_col,
    char_col,
    varchar_col,
    text_col,
    nchar_col,
    nvarchar_col,
    ntext_col,
    binary_col,
    varbinary_col,
    image_col,
    -- geography_col,                                                     -- not supported in tiberius
    -- geometry_col,                                                      -- not supported in tiberius
    -- hierarchyid_col,                                                   -- not supported in tiberius
    json_col,
    -- sql_variant_col,                                                   -- not supported in tiberius
    uniqueidentifier_col,
    xml_col,
    varchar_max_col,
    nvarchar_max_col,
    varbinary_max_col
) VALUES (
    255,
    32767,
    2147483647,
    9223372036854775807,
    1,
    12345.67,
    12345.67,
    922337203685477.5807,
    214748.3647,
    123456789.123456,
    123456.789,
    '2024-05-28',
    '12:34:56.1234567',
    '2024-05-28 12:34:56.1234567',
    '2024-05-28 12:34:56.1234567 +01:00',
    '2024-05-28 12:34:56',
    '2024-05-28 12:34:00',
    'CHAR      ',
    'VARCHAR',
    'TEXT',
    N'NCHAR     ',
    N'NVARCHAR',
    N'NTEXT',
    0x0102030405,
    0x0102030405,
    0x0102030405,
    -- geography::STGeomFromText('POINT(-122.34900 47.65100)', 4326),     -- not supported in tiberius
    -- geometry::STGeomFromText('POINT(1 1)', 0),                         -- not supported in tiberius
    -- CAST('/1/2/3/' AS HIERARCHYID),                                    -- not supported in tiberius
    N'{"key": "value"}',
    -- CAST('SQL Variant' AS SQL_VARIANT),                                -- not supported in tiberius
    'abcb8303-a0a2-4392-848b-3b32181d224b',
    '<root><element>value</element></root>',
    REPLICATE('A', 8000), -- VARCHAR(MAX)
    REPLICATE(N'A', 8000), -- NVARCHAR(MAX)
    CAST(REPLICATE(CAST('A' AS VARBINARY), 8000) AS VARBINARY(MAX)) -- VARBINARY(MAX)
);

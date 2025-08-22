DROP TABLE IF EXISTS `all_native_data_types`;

CREATE TABLE `all_native_data_types` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tinyint_col` TINYINT,
    `smallint_col` SMALLINT,
    `mediumint_col` MEDIUMINT,
    `int_col` INT,
    `bigint_col` BIGINT,
    `decimal_col` DECIMAL(10,2),
    `float_col` FLOAT,
    `double_col` DOUBLE,
    `bit_col` BIT(1),
    `char_col` CHAR(10),
    `varchar_col` VARCHAR(255),
    `binary_col` BINARY(10),
    `varbinary_col` VARBINARY(255),
    `tinyblob_col` TINYBLOB,
    `blob_col` BLOB,
    `mediumblob_col` MEDIUMBLOB,
    `longblob_col` LONGBLOB,
    `tinytext_col` TINYTEXT,
    `text_col` TEXT,
    `mediumtext_col` MEDIUMTEXT,
    `longtext_col` LONGTEXT,
    `enum_col` ENUM('value1', 'value2', 'value3'),
    `set_col` SET('value1', 'value2', 'value3'),
    `date_col` DATE,
    `datetime_col` DATETIME,
    `timestamp_col` TIMESTAMP,
    `time_col` TIME,
    `year_col` YEAR,
    `json_col` JSON,
    `null_bool_col` BOOLEAN
);

INSERT INTO `all_native_data_types` (
    `tinyint_col`, `smallint_col`, `mediumint_col`, `int_col`, `bigint_col`,
    `decimal_col`, `float_col`, `double_col`, `bit_col`, `char_col`,
    `varchar_col`, `binary_col`, `varbinary_col`, `tinyblob_col`, `blob_col`,
    `mediumblob_col`, `longblob_col`, `tinytext_col`, `text_col`, `mediumtext_col`,
    `longtext_col`, `enum_col`, `set_col`, `date_col`, `datetime_col`,
    `timestamp_col`, `time_col`, `year_col`, `json_col`, `null_bool_col`
) VALUES (
    127, 32767, 8388607, 2147483647, 9223372036854775807,
    12345.67, 123.45, 123456789.123456, b'1', 'char_data',
    'varchar_data', BINARY('bin_data'), BINARY('varbin_data'), BINARY('tinyblob'), BINARY('blob'),
    BINARY('mediumblob'), BINARY('longblob'), 'tinytext_data', 'text_data', 'mediumtext_data',
    'longtext_data', 'value1', 'value1,value2', '2024-05-28', '2024-05-28 12:34:56',
    '2024-05-28 12:34:56', '12:34:56', 2024, '{"key": "value"}', null
);

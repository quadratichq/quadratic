DROP TABLE IF EXISTS "public"."all_native_data_types";

CREATE SEQUENCE IF NOT EXISTS all_native_data_types_id_seq;
CREATE SEQUENCE IF NOT EXISTS all_native_data_types_serial_col_seq;
CREATE SEQUENCE IF NOT EXISTS all_native_data_types_bigserial_col_seq;

CREATE TABLE "public"."all_native_data_types" (
    "id" int4 NOT NULL DEFAULT nextval('all_native_data_types_id_seq'::regclass),
    "smallint_col" int2,
    "integer_col" int4,
    "bigint_col" int8,
    "decimal_col" numeric(10,2),
    "numeric_col" numeric(10,2),
    "real_col" float4,
    "double_col" float8,
    "serial_col" int4 NOT NULL DEFAULT nextval('all_native_data_types_serial_col_seq'::regclass),
    "bigserial_col" int8 NOT NULL DEFAULT nextval('all_native_data_types_bigserial_col_seq'::regclass),
    "money_col" money,
    "char_col" bpchar(10),
    "varchar_col" varchar(255),
    "text_col" text,
    "bytea_col" bytea,
    "timestamp_col" timestamp,
    "timestamptz_col" timestamptz,
    "date_col" date,
    "time_col" time,
    "timetz_col" timetz,
    "interval_col" interval,
    "boolean_col" bool,
    "enum_col" varchar(10) CHECK ((enum_col)::text = ANY ((ARRAY['value1'::character varying, 'value2'::character varying, 'value3'::character varying])::text[])),
    "point_col" point,
    "line_col" line,
    "lseg_col" lseg,
    "box_col" box,
    "path_col" path,
    "polygon_col" polygon,
    "circle_col" circle,
    "cidr_col" cidr,
    "inet_col" inet,
    "macaddr_col" macaddr,
    "json_col" json,
    "jsonb_col" jsonb,
    "uuid_col" uuid,
    "xml_col" xml,
    "array_col" int4[],
    "smallint_array_col" int2[],
    "bigint_array_col" int8[],
    "numeric_array_col" numeric(10,2)[],
    "real_array_col" float4[],
    "double_array_col" float8[],
    "text_array_col" text[],
    "varchar_array_col" varchar(255)[],
    "boolean_array_col" bool[],
    "timestamp_array_col" timestamp[],
    "date_array_col" date[],
    "jsonb_array_col" jsonb[],
    "null_bool_col" bool,
    PRIMARY KEY ("id")
);

INSERT INTO "public"."all_native_data_types" ("id", "smallint_col", "integer_col", "bigint_col", "decimal_col", "numeric_col", "real_col", "double_col", "serial_col", "bigserial_col", "money_col", "char_col", "varchar_col", "text_col", "bytea_col", "timestamp_col", "timestamptz_col", "date_col", "time_col", "timetz_col", "interval_col", "boolean_col", "enum_col", "point_col", "line_col", "lseg_col", "box_col", "path_col", "polygon_col", "circle_col", "cidr_col", "inet_col", "macaddr_col", "json_col", "jsonb_col", "uuid_col", "xml_col", "array_col", "smallint_array_col", "bigint_array_col", "numeric_array_col", "real_array_col", "double_array_col", "text_array_col", "varchar_array_col", "boolean_array_col", "timestamp_array_col", "date_array_col", "jsonb_array_col", "null_bool_col") VALUES
(1, 32767, 2147483647, 9223372036854775807, 12345.67, 12345.67, 123.45, 123456789.123456, 1, 1, '$100.00', 'char_data', 'varchar_data', 'text_data', '\x5c784445414442454546', '2024-05-20 12:34:56', '2024-05-20 06:34:56+00', '2024-05-20', '12:34:56', '12:34:56+09:30', '1 year 2 mons 3 days 04:05:06', 't', 'value1', '(1,1)', '{1,-1,0}', '[(0,0),(1,1)]', '(1,1),(0,0)', '((0,0),(1,1),(1,0),(0,0))', '((0,0),(1,1),(1,0),(0,0))', '<(0,0),1>', '192.168.1.0/24', '192.168.1.1', '08:00:2b:01:02:03', '{"key": "value"}', '{"key": "value"}', '123e4567-e89b-12d3-a456-426614174000', '<tag>value</tag>', '{1,2,3}', '{32767,16384,8192}', '{9223372036854775807,4611686018427387903,2305843009213693951}', '{123.45,67.89,12.34}', '{123.45,67.89,12.34}', '{123456789.123456,987654321.987654,555555555.555555}', '{text1,text2,text3}', '{varchar1,varchar2,varchar3}', '{true,false,true}', '{2024-05-20 12:34:56,2024-06-15 15:30:00,2024-07-10 09:15:30}', '{2024-05-20,2024-06-15,2024-07-10}', '{"{\"key1\": \"value1\"}","{\"key2\": \"value2\"}","{\"key3\": \"value3\"}"}', null);

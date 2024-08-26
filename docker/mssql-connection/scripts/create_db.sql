USE master;

-- Drop existing database
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'AllTypes')
BEGIN
    ALTER DATABASE AllTypes SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE AllTypes;
END

-- Create a new database
CREATE DATABASE AllTypes;
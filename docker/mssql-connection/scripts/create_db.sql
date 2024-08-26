USE master;

-- Drop existing database
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'YourAppDB')
BEGIN
    ALTER DATABASE YourAppDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE YourAppDB;
END

-- Create a new database
CREATE DATABASE YourAppDB;
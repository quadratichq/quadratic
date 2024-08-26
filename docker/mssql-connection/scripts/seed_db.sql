-- Switch to the new database
USE YourAppDB;

-- Create the EMPLOYEE table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EMPLOYEE]') AND type in (N'U'))
BEGIN
    CREATE TABLE EMPLOYEE (
      empId int,
      name varchar(15),
      dept varchar(10)
    );
END

-- Insert sample data
IF NOT EXISTS (SELECT * FROM EMPLOYEE)
BEGIN
    INSERT INTO EMPLOYEE(empId,name,dept) VALUES (1, 'Clark', 'Sales');
    INSERT INTO EMPLOYEE(empId,name,dept) VALUES (2, 'Dave', 'Accounting');
    INSERT INTO EMPLOYEE(empId,name,dept) VALUES (3, 'Ava', 'Sales');
END

-- Verify the data
SELECT * FROM EMPLOYEE;
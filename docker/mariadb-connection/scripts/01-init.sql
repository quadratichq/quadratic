-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS `mariadb-connection`;

-- Create user if it doesn't exist and grant privileges
CREATE USER IF NOT EXISTS 'user'@'%' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON `mariadb-connection`.* TO 'user'@'%';
FLUSH PRIVILEGES; 
FROM mcr.microsoft.com/azure-sql-edge

USER root

# Set environment variables
ENV ACCEPT_EULA=Y
ENV MSSQL_SA_PASSWORD=yourStrong(!)Password

# Install SSH and other required packages
RUN apt-get update && apt-get install -y \
  openssh-server \
  sudo \
  curl \
  apt-transport-https \
  lsb-release \
  gnupg \
  wget \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Install go-sqlcmd
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg
RUN curl https://packages.microsoft.com/config/debian/11/prod.list | tee /etc/apt/sources.list.d/mssql-release.list
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y sqlcmd && apt-get clean && rm -rf /var/lib/apt/lists/*

# Configure SSH server
RUN mkdir -p /var/run/sshd
RUN echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
RUN echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config

# Create a user for SSH access
RUN useradd -m -s /bin/bash -G sudo dbuser
RUN echo 'dbuser:password' | chpasswd

# Copy the public key
RUN mkdir -p /root/.ssh
COPY docker/keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Create SQL initialization script
RUN mkdir -p /sql-scripts
RUN echo "CREATE DATABASE mydb;" > /sql-scripts/01-create-db.sql
RUN echo "CREATE DATABASE AllTypes;" > /sql-scripts/02-create-db.sql
RUN echo "CREATE LOGIN dbuser WITH PASSWORD='$MSSQL_SA_PASSWORD';" > /sql-scripts/03-create-login.sql
RUN echo "ALTER SERVER ROLE sysadmin ADD MEMBER dbuser;" > /sql-scripts/04-add-role.sql
RUN echo "USE mydb; CREATE USER dbuser FOR LOGIN dbuser;" > /sql-scripts/04-create-user.sql
RUN echo "USE mydb; ALTER ROLE db_owner ADD MEMBER dbuser;" > /sql-scripts/05-add-db-role.sql
RUN echo "USE AllTypes; CREATE USER dbuser FOR LOGIN dbuser;" > /sql-scripts/06-create-user.sql
RUN echo "USE AllTypes; ALTER ROLE db_owner ADD MEMBER dbuser;" > /sql-scripts/07-add-db-role.sql

# Create a simple table with sample data
RUN echo "USE mydb; \
  CREATE TABLE Employees ( \
  EmployeeID INT PRIMARY KEY IDENTITY(1,1), \
  FirstName NVARCHAR(50) NOT NULL, \
  LastName NVARCHAR(50) NOT NULL, \
  Email NVARCHAR(100), \
  HireDate DATE, \
  Salary DECIMAL(10, 2) \
  );" > /sql-scripts/06-create-table.sql

RUN echo "USE mydb; \
  INSERT INTO Employees (FirstName, LastName, Email, HireDate, Salary) VALUES \
  ('John', 'Doe', 'john.doe@example.com', '2023-01-15', 75000.00), \
  ('Jane', 'Smith', 'jane.smith@example.com', '2023-03-22', 82000.00);" > /sql-scripts/07-insert-data.sql

# Create a shell script to initialize the database
RUN echo '#!/bin/bash' > /init_db.sh
RUN echo 'echo "Waiting for SQL Server to start..."' >> /init_db.sh
RUN echo 'sleep 30' >> /init_db.sh
RUN echo 'echo "SQL Server should be running now."' >> /init_db.sh
RUN echo 'echo "Attempting to initialize database using sqlcmd..."' >> /init_db.sh
RUN echo 'if command -v sqlcmd &> /dev/null; then' >> /init_db.sh
RUN echo '    echo "sqlcmd found, attempting to initialize database..."' >> /init_db.sh
RUN echo '    # Configure sqlcmd to connect to local SQL Server' >> /init_db.sh
RUN echo '    export SQLCMDSERVER=localhost' >> /init_db.sh
RUN echo '    export SQLCMDUSER=SA' >> /init_db.sh
RUN echo '    export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"' >> /init_db.sh
RUN echo '' >> /init_db.sh
RUN echo '    # Execute each SQL script' >> /init_db.sh
RUN echo '    for script in /sql-scripts/*.sql; do' >> /init_db.sh
RUN echo '        echo "Executing $script"' >> /init_db.sh
RUN echo '        sqlcmd -i "$script" && echo "Success: $script" || echo "Failed: $script"' >> /init_db.sh
RUN echo '    done' >> /init_db.sh
RUN echo '    sqlcmd -i /docker-entrypoint-initdb.d/seed_db.sql &' >> /init_db.sh
RUN echo '    echo "Database initialization attempted. Check for errors above."' >> /init_db.sh
RUN echo 'else' >> /init_db.sh
RUN echo '    echo "sqlcmd not found. You will need to initialize the database manually."' >> /init_db.sh
RUN echo '    echo "You can connect to the database using:"' >> /init_db.sh
RUN echo '    echo "Host: localhost"' >> /init_db.sh
RUN echo '    echo "Port: 1433"' >> /init_db.sh
RUN echo '    echo "User: SA"' >> /init_db.sh
RUN echo '    echo "Password: $MSSQL_SA_PASSWORD"' >> /init_db.sh
RUN echo 'fi' >> /init_db.sh
RUN chmod +x /init_db.sh

# Create startup script
RUN echo '#!/bin/bash' > /start.sh
RUN echo '/opt/mssql/bin/sqlservr &' >> /start.sh
RUN echo '/init_db.sh &' >> /start.sh
RUN echo '/usr/sbin/sshd -D' >> /start.sh
RUN chmod +x /start.sh

# Expose SSH port (SQL Server port 1433 is already exposed in the base image)
EXPOSE 22 1433

# Start services
CMD ["/start.sh"]

FROM mcr.microsoft.com/mssql/server:2022-latest

USER root

# Set environment variables
ENV ACCEPT_EULA=Y
ENV MSSQL_SA_PASSWORD=StrongPassword123!

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

# Configure SSH server
RUN mkdir -p /var/run/sshd
RUN echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
RUN echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config

# Create a user for SSH access
RUN useradd -m -s /bin/bash -G sudo dbuser
RUN echo 'dbuser:password' | chpasswd

# Copy the public key
RUN mkdir -p /root/.ssh
COPY keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Create startup script
RUN echo '#!/bin/bash\n\
  # Start SQL Server\n\
  /opt/mssql/bin/sqlservr &\n\
  \n\
  # Wait for SQL Server to start\n\
  sleep 30\n\
  \n\
  # Create database and user\n\
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P $MSSQL_SA_PASSWORD -Q "CREATE DATABASE mydb"\n\
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P $MSSQL_SA_PASSWORD -Q "CREATE LOGIN dbuser WITH PASSWORD='\''dbpassword'\''"\n\
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P $MSSQL_SA_PASSWORD -Q "ALTER SERVER ROLE sysadmin ADD MEMBER dbuser"\n\
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P $MSSQL_SA_PASSWORD -Q "USE mydb; CREATE USER dbuser FOR LOGIN dbuser"\n\
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P $MSSQL_SA_PASSWORD -Q "USE mydb; ALTER ROLE db_owner ADD MEMBER dbuser"\n\
  \n\
  # Start SSH server in foreground\n\
  /usr/sbin/sshd -D\n\
  ' > /start.sh && chmod +x /start.sh

# Expose SSH port (SQL Server port 1433 is already exposed in the base image)
EXPOSE 22

# Start services
CMD ["/start.sh"]

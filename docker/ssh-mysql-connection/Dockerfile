FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install MySQL, SSH server, and other utilities
RUN apt-get update && apt-get install -y \
  mysql-server \
  openssh-server \
  sudo \
  openssl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Configure SSH server
RUN mkdir /var/run/sshd
RUN echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
RUN echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config

# Create a user for SSH access
RUN useradd -m -s /bin/bash -G sudo dbuser
RUN echo 'dbuser:password' | chpasswd

# Copy the public key
RUN mkdir -p /root/.ssh
COPY keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Generate SSL certificates for MySQL
RUN mkdir -p /etc/mysql/ssl
RUN openssl req -new -x509 -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
  -out /etc/mysql/ssl/server.crt \
  -keyout /etc/mysql/ssl/server.key
RUN chmod 600 /etc/mysql/ssl/server.key
RUN chown mysql:mysql /etc/mysql/ssl/server.key /etc/mysql/ssl/server.crt

# Create MySQL data directory and set permissions
RUN mkdir -p /var/run/mysqld /var/lib/mysql
RUN chown -R mysql:mysql /var/run/mysqld /var/lib/mysql
RUN chmod 777 /var/run/mysqld

# Configure MySQL to use SSL and listen on all interfaces
RUN echo "[mysqld]" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "bind-address = 0.0.0.0" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "ssl=on" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "ssl-cert=/etc/mysql/ssl/server.crt" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "ssl-key=/etc/mysql/ssl/server.key" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "pid-file=/var/run/mysqld/mysqld.pid" >> /etc/mysql/mysql.conf.d/mysqld.cnf && \
  echo "socket=/var/run/mysqld/mysqld.sock" >> /etc/mysql/mysql.conf.d/mysqld.cnf

# Create startup script with proper initialization
RUN echo '#!/bin/bash\n\
  # Initialize MySQL data directory if needed\n\
  if [ ! -d "/var/lib/mysql/mysql" ]; then\n\
  mysqld --initialize-insecure --user=mysql\n\
  fi\n\
  \n\
  # Start MySQL service\n\
  service mysql start\n\
  \n\
  # Wait for MySQL to be ready\n\
  while ! mysqladmin ping --silent; do\n\
  sleep 1\n\
  done\n\
  \n\
  # Configure MySQL users and database\n\
  mysql -e "CREATE USER IF NOT EXISTS '\''dbuser'\''@'\''%'\'' IDENTIFIED BY '\''dbpassword'\'';" \n\
  mysql -e "GRANT ALL PRIVILEGES ON *.* TO '\''dbuser'\''@'\''%'\'' WITH GRANT OPTION;" \n\
  mysql -e "CREATE DATABASE IF NOT EXISTS mydb;" \n\
  mysql -e "FLUSH PRIVILEGES;" \n\
  \n\
  # Start SSH server in foreground\n\
  /usr/sbin/sshd -D\n\
  ' > /start.sh && chmod +x /start.sh

# Expose SSH and MySQL ports
EXPOSE 22 3306

# Start services
CMD ["/start.sh"]

FROM ubuntu:22.04

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install PostgreSQL, SSH server, and other utilities
RUN apt-get update && apt-get install -y \
  postgresql \
  postgresql-contrib \
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
RUN mkdir /root/.ssh
COPY keys/id_rsa.pub /root/.ssh/authorized_keys
RUN chmod 600 /root/.ssh/authorized_keys

# Generate SSL certificates for PostgreSQL
RUN mkdir -p /etc/postgresql/ssl
RUN openssl req -new -x509 -days 365 -nodes \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" \
  -out /etc/postgresql/ssl/server.crt \
  -keyout /etc/postgresql/ssl/server.key
RUN chmod 600 /etc/postgresql/ssl/server.key
RUN chown postgres:postgres /etc/postgresql/ssl/server.key /etc/postgresql/ssl/server.crt

# Configure PostgreSQL
USER postgres
RUN /etc/init.d/postgresql start && \
  psql --command "CREATE USER dbuser WITH SUPERUSER PASSWORD 'dbpassword';" && \
  createdb -O dbuser mydb

# Configure PostgreSQL to use SSL and listen on all interfaces
RUN echo "listen_addresses = '*'" >> /etc/postgresql/14/main/postgresql.conf && \
  echo "ssl = on" >> /etc/postgresql/14/main/postgresql.conf && \
  echo "ssl_cert_file = '/etc/postgresql/ssl/server.crt'" >> /etc/postgresql/14/main/postgresql.conf && \
  echo "ssl_key_file = '/etc/postgresql/ssl/server.key'" >> /etc/postgresql/14/main/postgresql.conf

# Update PostgreSQL authentication configuration
RUN echo "hostssl all             all             0.0.0.0/0               md5" > /etc/postgresql/14/main/pg_hba.conf && \
  echo "host    all             all             127.0.0.1/32            md5" >> /etc/postgresql/14/main/pg_hba.conf && \
  echo "host    all             all             ::1/128                 md5" >> /etc/postgresql/14/main/pg_hba.conf

USER root

# Create startup script
RUN echo '#!/bin/bash\n\
  service postgresql start\n\
  /usr/sbin/sshd -D\n\
  ' > /start.sh && chmod +x /start.sh

# Expose SSH and PostgreSQL ports
EXPOSE 22

# Start services
CMD ["/start.sh"]

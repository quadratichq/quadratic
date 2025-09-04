FROM meltano/meltano:latest

# Set working directory
WORKDIR /project

# Copy essential project files
COPY meltano.yml .
COPY requirements.txt .

# Copy directory structure
COPY extract/ extract/
COPY load/ load/
COPY transform/ transform/
COPY analyze/ analyze/
COPY notebook/ notebook/
COPY orchestrate/ orchestrate/
COPY output/ output/

# Copy optional files
COPY README*.md ./
COPY *.sh ./

# Install dependencies for LocalStack integration and DataFusion
RUN apt-get update && apt-get install -y awscli && rm -rf /var/lib/apt/lists/*
RUN pip install datafusion pyarrow pandas requests

# Copy Python scripts
COPY *.py ./

# Make scripts executable
RUN chmod +x *.sh *.py

# Expose port for Meltano UI (optional)
EXPOSE 5000

# Default command - keep container running for development
CMD ["/bin/bash", "-c", "tail -f /dev/null"]

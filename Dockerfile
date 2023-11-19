FROM rust:latest

# Install npm
RUN apt-get update && apt-get install -y npm

# Install wasm-pack
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Add wasm32 target
RUN rustup target add wasm32-unknown-unknown

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the files
COPY . .

# Build Rust/WASM
RUN npm run build:wasm

# Start the app
CMD ["npm", "start"]
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY quadratic-client ./quadratic-client
COPY quadratic-shared ./quadratic-shared
RUN npm install

FROM node:18-slim AS runtime
WORKDIR /app
COPY --from=builder /app .
CMD ["npm", "start"]

FROM node:18
RUN mkdir -p /quadratic
WORKDIR /quadratic
COPY package*.json .
RUN npm install
COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared
WORKDIR /quadratic/quadratic-shared
RUN npm install
WORKDIR /quadratic/quadratic-api
RUN npm install
RUN npm run build --workspace=quadratic-api
CMD ["node", "dist/server.js"]
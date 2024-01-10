FROM node:18
RUN mkdir -p /quadratic
WORKDIR /quadratic
COPY package*.json .
COPY quadratic-api ./quadratic-api
COPY quadratic-shared ./quadratic-shared
WORKDIR /quadratic/quadratic-shared
RUN npm install
WORKDIR /quadratic/quadratic-api
RUN npm install
CMD ["npm", "start"]
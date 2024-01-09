FROM node:latest
RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install
COPY src/ .
CMD [ "npm", "start"]
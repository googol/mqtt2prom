FROM node:18-alpine

EXPOSE 4000
CMD ["node", "src/main.js"]

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY src/* ./src/

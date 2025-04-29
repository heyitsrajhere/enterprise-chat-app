FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

RUN chown -R node:node /usr/src/app

USER node

CMD ["npm", "run", "start:dev"]
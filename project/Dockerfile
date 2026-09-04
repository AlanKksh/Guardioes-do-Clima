FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 8080

CMD ["npx", "fiori", "run", "--port", "8080", "--accept-remote-connections"]

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "--no-warnings", "src/server.js"]

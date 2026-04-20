FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm install --include=dev --workspaces --include-workspace-root
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/app.db
RUN apk add --no-cache python3 make g++ \
 && mkdir -p /data
COPY package.json ./
COPY server/package.json server/
RUN npm install --omit=dev --workspace server --include-workspace-root \
 && apk del python3 make g++
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server/dist/index.js"]

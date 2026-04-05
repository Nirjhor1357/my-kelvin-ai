FROM node:20-alpine AS base
RUN apk add --no-cache openssl python3 make g++
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 8080
CMD ["npm", "run", "start"]

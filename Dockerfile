# ---------- 1. Фаза: градња (сервер + клијент) ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Зависности сервера (укључујући devDependencies — tsc је потребан за градњу)
COPY package*.json ./
RUN npm ci

# Зависности клијента
COPY client/package*.json ./client/
RUN npm ci --prefix client

# Изворни код
COPY tsconfig.json ./
COPY src ./src
COPY client ./client

# dist/ (сервер) и client/build/ (React)
RUN npm run build && npm run build --prefix client


# ---------- 2. Фаза: покретање ----------
FROM node:20-bookworm-slim
WORKDIR /app

# ffmpeg за обраду видеа + фонтови за титлове.
#
# ВАЖНО: титлови користе Arial, којег на Linux-у нема. fonts-liberation
# доноси Liberation Sans, који је МЕТРИЧКИ ИДЕНТИЧАН Arial-у, а fontconfig
# у Debian-у аутоматски преусмерава Arial -> Liberation Sans. Без овог
# пакета libass би узео неки други фонт, ширина текста би се променила и
# извоз више не би одговарао прегледу (WYSIWYG).
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg \
      fontconfig \
      fonts-liberation \
 && fc-cache -f \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001

# Само production зависности
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Изграђени сервер и клијент
COPY --from=build /app/dist ./dist
COPY --from=build /app/client/build ./client/build

# Фолдери за податке (у compose-у се везују за диск домаћина)
RUN mkdir -p uploads exports

EXPOSE 3001

# Провера здравља — Docker рестартује контејнер ако сервер закочи
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/app.js"]

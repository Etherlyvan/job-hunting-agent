FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY requirements-web.txt ./
RUN python3 -m venv /opt/python && /opt/python/bin/pip install --no-cache-dir -r requirements-web.txt
ENV PATH="/opt/python/bin:$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/tools ./tools
COPY --from=build --chown=node:node /app/.claude/skills/job-application-assistant/03-writing-style.md /app/.claude/skills/job-application-assistant/04-job-evaluation.md /app/.claude/skills/job-application-assistant/07-interview-prep.md ./.claude/skills/job-application-assistant/
USER node
EXPOSE 3000
CMD ["node", "server.js"]

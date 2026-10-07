# The game server image: the API plus the web build it serves (D68), and the Discord bot (W8).
# Built on the VPS from a `git archive` of the repo (scripts/deploy.sh).
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
# The API, the web client and the Discord bot (W8: the same image runs the bot's container).
RUN pnpm install --frozen-lockfile \
  --filter "@wipe-day/api..." --filter "@wipe-day/web..." --filter "@wipe-day/discord..."
RUN pnpm --filter @wipe-day/web build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://localhost:8787/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/main.ts"]

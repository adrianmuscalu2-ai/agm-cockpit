FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

RUN pnpm --filter @agm/web build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /srv

COPY --from=build /app/apps/web/dist /srv/agm-web
COPY deploy/production/serve-static.mjs /srv/serve-static.mjs

USER node
EXPOSE 4173

CMD ["node", "/srv/serve-static.mjs"]

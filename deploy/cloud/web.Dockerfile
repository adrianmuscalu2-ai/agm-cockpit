FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/library-control-plane/package.json packages/library-control-plane/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY config/operations-health.json config/operations-health.json
COPY packages/shared packages/shared
COPY packages/library-control-plane packages/library-control-plane
COPY apps/web apps/web

RUN pnpm --filter @agm/shared build
RUN pnpm --filter @agm/library-control-plane build
RUN pnpm --filter @agm/web build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /srv

COPY --from=build /app/apps/web/dist /srv/agm-web
COPY deploy/production/serve-static.mjs /srv/serve-static.mjs

USER node
EXPOSE 4173

CMD ["node", "/srv/serve-static.mjs"]

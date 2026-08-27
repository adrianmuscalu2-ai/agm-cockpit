ARG BASE_IMAGE
FROM ${BASE_IMAGE}

USER root
COPY --chown=node:node prisma/migrations/20260816090000_refresh_families_and_dsar /app/prisma/migrations/20260816090000_refresh_families_and_dsar
COPY --chown=node:node prisma/migrations/20260816190000_add_dsar_external_and_subject_index /app/prisma/migrations/20260816190000_add_dsar_external_and_subject_index
COPY --chown=node:node deploy/production/dsar-foundation /app/apps/api/dsar-foundation
COPY --chown=node:node apps/api/src/data-rights /app/apps/api/src/data-rights

USER node


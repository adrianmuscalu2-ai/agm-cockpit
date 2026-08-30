FROM node:22-alpine
WORKDIR /gateway
COPY deploy/field-test/field-only-gateway.mjs /gateway/field-only-gateway.mjs
USER node
EXPOSE 3301
CMD ["node","/gateway/field-only-gateway.mjs"]

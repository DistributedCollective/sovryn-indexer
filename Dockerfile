FROM node:24.8.0-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY . ./

# Install deps and build
RUN pnpm install && pnpm typechain && pnpm build && cp -r /src/artifacts/* /build/artifacts

ENV NODE_ENV=production

EXPOSE 8000

ENTRYPOINT [ "node", "build/index.js"]

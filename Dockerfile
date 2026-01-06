FROM node:24.8.0

ENV NODE_ENV=production
EXPOSE 8000

RUN corepack enable

COPY . ./

# Install deps and build
RUN pnpm install
RUN pnpm typechain
RUN pnpm build
RUN cp -r /src/artifacts/* /build/artifacts

CMD [ "node", "build/index.js"]

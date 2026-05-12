FROM node:20-alpine

WORKDIR /app
COPY package.json index.js prompts.json ./

# No deps — we use the built-in fetch / AbortController / readFileSync.
USER node
CMD ["node", "index.js"]

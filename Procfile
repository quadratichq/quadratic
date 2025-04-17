web: export VERSION=$(cat VERSION) && cd quadratic-api && node dist/src/server.js

release: cd quadratic-api && npx prisma migrate deploy

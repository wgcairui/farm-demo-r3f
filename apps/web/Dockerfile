# farm-demo web 静态站 Dockerfile
# build context = 仓库根（workspaces 模式）
# 仿 uart-docs-public：bun builder → nginx:alpine runtime
#
# build:
#   docker buildx build --no-cache -f apps/web/Dockerfile -t farm-demo-web:latest .

# ---- builder stage ----
FROM node:24-alpine AS builder

WORKDIR /app

# 先 copy workspaces 元信息，让 Docker 缓存 deps 层（避免源码改动就重 install）
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/game/package.json ./packages/game/
COPY packages/assets/package.json ./packages/assets/

# npm ci 装 workspaces（web ^7.0.2 / mobile ~6.0.3 双 TS 故意不动，这里只跑 web build）
RUN npm ci --no-audit --no-fund --ignore-scripts 2>&1 | tail -5

# 业务源码：apps/web（含 vite 配置 + src） + packages（game 包 + assets 含 GLB）
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# build：tsc 类型检查 + vite build（产出 dist/）
# 在 apps/web 子目录跑，让 npm 优先解析 apps/web/node_modules/.bin/tsc（^7.0.2），
# 避免被 root node_modules 的 tsc（6.0.3，来自 expo SDK 锁定）覆盖导致 implicit-any 误报
RUN cd /app/apps/web && npm run build 2>&1 | tail -20

# ---- runtime stage ----
FROM nginx:alpine

# 把 dist 灌进 nginx 默认站点根目录
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA fallback + 长缓存 + gzip（覆盖 nginx:alpine 默认配置）
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 健康检查（同 docs-public 模式）
HEALTHCHECK CMD wget -qO- -Y off http://127.0.0.1/ || exit 1
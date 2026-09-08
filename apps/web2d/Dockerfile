# farm-demo 2D web 静态站 Dockerfile
# build context = 仓库根（workspaces 模式）
# build:
#   docker buildx build --no-cache -f apps/web2d/Dockerfile -t farm-demo-web2d:latest .
# run:
#   docker run --rm -p 8080:80 farm-demo-web2d:latest
#
# 与 apps/web/Dockerfile 结构对齐：node:24-alpine builder → nginx:alpine runtime。
# web2d 与 web 是两个独立的 Docker 镜像（部署不同端口/域名），互不影响。

# ---- builder stage ----
FROM node:24-alpine AS builder

WORKDIR /app

# 先 copy workspaces 元信息，让 Docker 缓存 deps 层
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/web2d/package.json ./apps/web2d/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/game/package.json ./packages/game/
COPY packages/assets/package.json ./packages/assets/

RUN npm ci --no-audit --no-fund --ignore-scripts 2>&1 | tail -5

# 业务源码：web2d 不引用 three/R3F，但 workspaces 仍要把全部 apps/* 拷过来
COPY packages/ ./packages/
COPY apps/web2d/ ./apps/web2d/
COPY apps/web/ ./apps/web/
COPY apps/mobile/ ./apps/mobile/

# build：tsc --noEmit + vite build（产出 dist/）
# 在 apps/web2d 子目录跑，让 npm 优先解析 apps/web2d/node_modules/.bin/tsc（^7.0.2）
RUN cd /app/apps/web2d && npm run build 2>&1 | tail -20

# ---- runtime stage ----
FROM nginx:alpine

# 把 dist 灌进 nginx 默认站点根目录
COPY --from=builder /app/apps/web2d/dist /usr/share/nginx/html

# SPA fallback + 长缓存 + gzip（复用 web 版 nginx 配置）
COPY apps/web2d/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK CMD wget -qO- -Y off http://127.0.0.1/ || exit 1

# 站点镜像：用 nginx 托管构建好的静态站点。
# 镜像里只有 dist/ 的静态文件，不需要 Node，也不跑任何后端。
#
# 先构建，再打镜像：
#     pnpm build
#     docker build -t tarot-site .
#     docker run --rm -p 8080:80 tarot-site
#
# 已经发布的镜像（由 GitHub Actions 自动构建）：
#     docker run --rm -p 8080:80 ghcr.io/3-dd-del/tarot-site:latest

FROM nginx:alpine

# 目录式路由（/read/、/cards/major-00/ 等）由 nginx 默认的 index 规则处理，
# 不需要额外配置；这里只覆盖缓存策略。
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  gzip on;' \
  '  gzip_types text/css application/javascript application/json image/svg+xml;' \
  '  location /_astro/ { add_header Cache-Control "public, max-age=31536000, immutable"; }' \
  '  location /img/    { add_header Cache-Control "public, max-age=31536000, immutable"; }' \
  '  location /sw.js   { add_header Cache-Control "no-cache"; }' \
  '  location / { try_files $uri $uri/ $uri/index.html =404; }' \
  '}' > /etc/nginx/conf.d/default.conf

COPY dist /usr/share/nginx/html

EXPOSE 80

#!/bin/bash
set -e

INSTALL_DIR="/opt/etloj"
REPO_URL="https://github.com/lQ17/ETLOJ.git"

echo "=========================================="
echo "  ETLOJ 裸机部署脚本"
echo "=========================================="

# ---- 首次部署：克隆代码 ----
if [ ! -d "$INSTALL_DIR/.git" ]; then
  echo ""
  echo "[INFO] 克隆项目..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ---- 检查 .env ----
if [ ! -f server/.env ]; then
  echo ""
  echo "[INFO] 创建 server/.env..."
  cat > server/.env << 'ENVEOF'
DATABASE_URL=mysql://root:${MYSQL_ROOT_PASSWORD:-CHANGE_ME}@127.0.0.1:3306/etloj
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=${JWT_SECRET:-CHANGE_ME}
JUDGE_SECRET=${JUDGE_SECRET:-CHANGE_ME}
GO_JUDGE_URL=http://127.0.0.1:5050
PROBLEMS_DIR=/opt/etloj/data/problems
PORT=3000
ENVEOF
  echo ""
  echo "[WARN] 请编辑 server/.env 填入真实密码和密钥！"
fi

if [ ! -f judge/.env ]; then
  echo ""
  echo "[INFO] 创建 judge/.env..."
  cat > judge/.env << 'ENVEOF'
JUDGE_SECRET=${JUDGE_SECRET:-CHANGE_ME}
ENVEOF
fi

# ---- 1. 安装系统依赖 ----
echo ""
echo "[1/8] 安装系统依赖..."
if ! command -v mysql &> /dev/null && ! command -v mariadb &> /dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server redis-server nginx gcc g++ python3 curl wget
fi

# ---- 2. 安装 Node.js 20 ----
echo ""
echo "[2/8] 检查 Node.js..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1)" != "v20" ] && [ "$(node -v | cut -d. -f1)" != "v22" ]; then
  echo "安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)  npm: $(npm -v)"

# ---- 3. 配置 MySQL ----
echo ""
echo "[3/8] 配置 MySQL..."
if ! mysql -u root -e "USE etloj;" &>/dev/null; then
  # MariaDB: root 用 socket 认证，先创建数据库，再设置密码
  mysql -u root -e "CREATE DATABASE IF NOT EXISTS etloj CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD:-CHANGE_ME}'; FLUSH PRIVILEGES;" 2>/dev/null || true
fi
echo "  MySQL OK"

# ---- 4. 下载 go-judge ----
echo ""
echo "[4/8] 检查 go-judge..."
if [ ! -f /usr/local/bin/go-judge ]; then
  GOJUDGE_VER="v1.9.0"  # 不要升级！v1.10+ 的 clone3(CLONE_INTO_CGROUP) 在 Debian 6.1 内核上有兼容性问题
  echo "  下载 go-judge $GOJUDGE_VER..."
  wget -q "https://github.com/criyle/go-judge/releases/download/${GOJUDGE_VER}/go-judge_${GOJUDGE_VER#v}_linux_amd64v2" -O /usr/local/bin/go-judge
  chmod +x /usr/local/bin/go-judge
fi
echo "  go-judge OK"

# ---- 5. 拉取最新代码 ----
echo ""
echo "[5/8] 拉取最新代码..."
git checkout -- .
git pull origin main

# ---- 6. 构建后端 ----
echo ""
echo "[6/8] 构建后端..."
cd "$INSTALL_DIR/server"
npm ci
npx prisma generate
npm run build
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true

# ---- 7. 构建前端 ----
echo ""
echo "[7/8] 构建前端..."
cd "$INSTALL_DIR/client"
npm ci --legacy-peer-deps
npm run build
mkdir -p /var/www/etloj
cp -r dist/* /var/www/etloj/

# ---- 8. 配置服务 ----
echo ""
echo "[8/8] 配置服务..."

# Nginx
cp "$INSTALL_DIR/nginx/default.conf" /etc/nginx/sites-available/etloj
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/etloj /etc/nginx/sites-enabled/etloj
nginx -t && systemctl restart nginx

# Systemd services
cp "$INSTALL_DIR"/deploy/etloj-*.service /etc/systemd/system/
systemctl daemon-reload

# 创建数据目录
mkdir -p "$INSTALL_DIR/data/problems"

# 启动服务
systemctl enable etloj-go-judge etloj-server etloj-judge
systemctl restart etloj-go-judge
sleep 2
systemctl restart etloj-server
sleep 2
systemctl restart etloj-judge

# 创建管理员
sleep 3
cd "$INSTALL_DIR/server"
node dist/seed.js 2>/dev/null || echo "管理员可能已存在"

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "  前端: http://$(hostname -I | awk '{print $1}')"
echo "  API:  http://$(hostname -I | awk '{print $1}')/api"
echo ""
echo "  查看日志:"
echo "    journalctl -u etloj-server -f"
echo "    journalctl -u etloj-judge -f"
echo "    journalctl -u etloj-go-judge -f"
echo ""
echo "  更新部署: cd $INSTALL_DIR && ./deploy.sh"
echo "=========================================="

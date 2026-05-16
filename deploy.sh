#!/bin/bash
set -e

REPO_URL="https://github.com/lQ17/ETLOJ.git"
INSTALL_DIR="/opt/etloj"

echo "=========================================="
echo "  ETLOJ 部署脚本"
echo "=========================================="

# ---- 首次部署：拉取代码 ----
if [ ! -d ".git" ]; then
  echo ""
  echo "[INFO] 当前目录不是 Git 仓库，正在克隆..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---- 检查 .env ----
if [ ! -f .env ]; then
  echo ""
  echo "[INFO] 未找到 .env，从模板创建..."
  cp .env.production .env
  echo ""
  echo "[WARN] 请先编辑 .env 修改密码和密钥："
  echo "       vim .env"
  echo ""
  echo "  修改后重新运行此脚本即可"
  exit 1
fi

# ---- 创建数据目录 ----
mkdir -p ./data/problems

# ---- 拉取最新代码（更新部署时） ----
if [ -d ".git" ]; then
  echo ""
  echo "[1/5] 拉取最新代码..."
  git pull origin main
fi

# ---- 构建镜像 ----
echo ""
echo "[2/5] 构建 Docker 镜像..."
docker compose build --no-cache

# ---- 启动基础设施 ----
echo ""
echo "[3/5] 启动基础设施..."
docker compose up -d mysql redis go-judge
echo "等待 MySQL 就绪..."
sleep 15

# ---- 启动全部服务 ----
echo ""
echo "[4/5] 启动应用服务..."
docker compose up -d

# ---- 初始化数据库 ----
echo ""
echo "[5/5] 初始化数据库..."
docker compose exec -T server npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "  前端: http://150.158.39.151"
echo "  API:  http://150.158.39.151/api"
echo ""
echo "  查看日志:   docker compose logs -f"
echo "  更新部署:   cd $INSTALL_DIR && ./deploy.sh"
echo "  停止服务:   docker compose down"
echo "=========================================="

#!/usr/bin/env bash
# mes-deploy.sh — MES 站(子路径 /mes/) 部署脚本：备份 → 部署 → 验证 → 失败自动回滚
#
# 硬规矩(与 DEPLOY.md 一致):
#   - 前端必须以 --base=/mes/ 构建; 脚本只搬运构建产物, 不改 vite.config.ts。
#   - 真实数据(pb_data)与学习存档不在备份/部署范围内被改动: 本脚本不碰 pb_data。
#   - 部署前必备份: 项目目录 + nginx 相关配置, 目录名带时间戳, 可回滚。
#   - 备份保留: 超过 KEEP 份时删除最早一份(同一套判定同时作用于项目与配置备份)。
#
# 用法(在服务器上执行):
#   BACKUP_ROOT=/var/backups/mes \
#   APP_DIR=/workspace/app \
#   PB_PUBLIC_DIR=/workspace/pocketbase-bin/pb_public \
#   PB_HOOKS_DIR=/workspace/pocketbase-bin/pb_hooks \
#   SERVER_DIR=/workspace/pocketbase-bin/server \
#   ./mes-deploy.sh --dist /tmp/mes-dist --hooks /path/to/templates/pb_hooks --server /path/to/server
#
# 可选环境变量:
#   SITE_URL        线上站点地址(默认 https://mes.nya.je)
#   SITE_PREFIX     子路径(默认 /mes)
#   KEEP            备份保留份数(默认 3)
#   NGINX_CONF_DIR  nginx 配置目录(默认 /etc/nginx/sites-available)
#   NGINX_CONF_EXT  nginx 站点配置文件后缀(默认 .conf)
#   PB_RESTART_CMD  重启 PocketBase 的命令(默认不动; 例如 "systemctl restart pocketbase")
set -euo pipefail

DIST_DIR=""
HOOKS_DIR=""
SERVER_SRC=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dist) DIST_DIR="$2"; shift 2 ;;
    --hooks) HOOKS_DIR="$2"; shift 2 ;;
    --server) SERVER_SRC="$2"; shift 2 ;;
    *) echo "未知参数: $1" >&2; exit 2 ;;
  esac
done

BACKUP_ROOT="${BACKUP_ROOT:?必须指定 BACKUP_ROOT}"
APP_DIR="${APP_DIR:?必须指定 APP_DIR(应用根目录)}"
PB_PUBLIC_DIR="${PB_PUBLIC_DIR:?必须指定 PB_PUBLIC_DIR(PocketBase 静态目录)}"
PB_HOOKS_DIR="${PB_HOOKS_DIR:?必须指定 PB_HOOKS_DIR(PocketBase 钩子目录)}"
SERVER_DIR="${SERVER_DIR:?必须指定 SERVER_DIR(执行器目录)}"
SITE_URL="${SITE_URL:-https://mes.nya.je}"
SITE_PREFIX="${SITE_PREFIX:-/mes}"
KEEP="${KEEP:-3}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx/sites-available}"
NGINX_CONF_EXT="${NGINX_CONF_EXT:-.conf}"
PB_RESTART_CMD="${PB_RESTART_CMD:-}"

if [ -z "$DIST_DIR" ] || [ ! -d "$DIST_DIR" ]; then
  echo "必须用 --dist 指定已构建好的 dist 目录(含 --base=/mes/ 的产物)" >&2
  exit 2
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${BACKUP_ROOT}/mes-backup-${STAMP}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() { echo "[mes-deploy $(date +%H:%M:%S)] $*"; }

# ---------- 1. 备份 ----------
log "开始备份到 $BACKUP_DIR"
mkdir -p "$BACKUP_DIR/app" "$BACKUP_DIR/nginx"
if [ -d "$APP_DIR" ]; then
  cp -a "$APP_DIR/." "$BACKUP_DIR/app/" || true
fi
if [ -d "$NGINX_CONF_DIR" ]; then
  cp -a "$NGINX_CONF_DIR/." "$BACKUP_DIR/nginx/" || true
fi
# 部署相关的实际生效路径也记进清单, 便于回滚时核对
{
  echo "stamp=$STAMP"
  echo "app_dir=$APP_DIR"
  echo "pb_public=$PB_PUBLIC_DIR"
  echo "pb_hooks=$PB_HOOKS_DIR"
  echo "server_dir=$SERVER_DIR"
  echo "site_url=$SITE_URL$SITE_PREFIX"
  echo "dist_source=$DIST_DIR"
  [ -f "$DIST_DIR/.mes-build-info" ] && cat "$DIST_DIR/.mes-build-info"
} > "$BACKUP_DIR/MANIFEST.txt"
# marker: 标记这是保留策略产出的备份(保留策略只认带 marker 的目录)
echo "created_by=mes-deploy.sh" > "$BACKUP_DIR/.policy-marker"
log "备份完成: $BACKUP_DIR"

# ---------- 2. 部署 ----------
log "部署前端产物到 $PB_PUBLIC_DIR"
mkdir -p "$PB_PUBLIC_DIR"
# 清掉旧产物(只动静态目录, 不动 pb_data)
find "$PB_PUBLIC_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
cp -a "$DIST_DIR/." "$PB_PUBLIC_DIR/"

if [ -n "$HOOKS_DIR" ] && [ -d "$HOOKS_DIR" ]; then
  log "同步 PocketBase 钩子到 $PB_HOOKS_DIR"
  mkdir -p "$PB_HOOKS_DIR"
  cp -a "$HOOKS_DIR/." "$PB_HOOKS_DIR/"
fi

if [ -n "$SERVER_SRC" ] && [ -d "$SERVER_SRC" ]; then
  log "同步执行器到 $SERVER_DIR"
  mkdir -p "$SERVER_DIR"
  cp -a "$SERVER_SRC/." "$SERVER_DIR/"
fi

if [ -n "$PB_RESTART_CMD" ]; then
  log "重启 PocketBase: $PB_RESTART_CMD"
  # shellcheck disable=SC2086
  $PB_RESTART_CMD || log "重启命令返回非 0, 继续验证(可能需要人工确认)"
fi

# ---------- 3. 验证 ----------
fail() {
  log "验证失败: $1"
  log "开始回滚到 $BACKUP_DIR"
  if [ -d "$BACKUP_DIR/app" ] && [ -d "$APP_DIR" ]; then
    cp -a "$BACKUP_DIR/app/." "$APP_DIR/" || true
  fi
  if [ -d "$BACKUP_DIR/nginx" ] && [ -d "$NGINX_CONF_DIR" ]; then
    cp -a "$BACKUP_DIR/nginx/." "$NGINX_CONF_DIR/" || true
  fi
  if [ -n "$PB_RESTART_CMD" ]; then
    # shellcheck disable=SC2086
    $PB_RESTART_CMD || true
  fi
  log "回滚完成, 请人工确认站点状态"
  exit 1
}

log "验证站点: ${SITE_URL}${SITE_PREFIX}/"
code="$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}${SITE_PREFIX}/" || echo 000)"
[ "$code" = "200" ] || fail "首页返回 HTTP $code"
log "首页 OK (HTTP 200)"

# 子路径资源: 入口脚本必须以 /mes/assets/ 引用(验证 --base=/mes/ 生效)
entry="$(curl -s "${SITE_URL}${SITE_PREFIX}/" | grep -oE '/mes/assets/[A-Za-z0-9._-]+\.js' | head -1 || true)"
[ -n "$entry" ] || fail "页面里找不到 /mes/assets/ 下的入口脚本, 疑似 base 未按 /mes/ 构建"
log "入口脚本: $entry"
code="$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}${entry}" || echo 000)"
[ "$code" = "200" ] || fail "入口脚本返回 HTTP $code"

# 运行时内容(关卡/术语/新模块内容)必须能按子路径取到
for probe in content/levels/index.json content/terms.json content/career-prep/index.json; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}${SITE_PREFIX}/${probe}" || echo 000)"
  [ "$code" = "200" ] || fail "内容文件 ${probe} 返回 HTTP $code"
  log "内容文件 OK: ${probe}"
done

# 后端路由: 未带 token 时业务 API 必须 401(说明鉴权生效, 而不是 404 路由缺失)
code="$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}${SITE_PREFIX}/__pb/api/player_progress" || echo 000)"
if [ "$code" = "401" ] || [ "$code" = "403" ]; then
  log "后端路由 OK: 未授权访问返回 $code(鉴权生效)"
else
  fail "后端路由异常: 未授权访问返回 HTTP $code(期望 401/403)"
fi

log "全部验证通过"

# ---------- 4. 保留策略 ----------
BACKUP_ROOT="$BACKUP_ROOT" KEEP="$KEEP" bash "$SCRIPT_DIR/backup-retention.sh"

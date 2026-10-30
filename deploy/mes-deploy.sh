#!/usr/bin/env bash
# mes-deploy.sh — MES 学习站部署脚本（备份 → 部署 → 校验 → 失败自动回滚）
#
# 设计前提（对应刘先生的硬约束）:
#   1. 学习进度数据不可破坏。备份必须同时含「项目源码 + nginx 配置 + PocketBase 存档数据本体」，
#      回滚要能一并还原存档数据。
#   2. 部署过程中的写操作只做「只加不删」的增量：不 DROP/TRUNCATE 任何集合、不清空表、
#      不重置进度字段。脚本自身不会写入 player_progress 集合的任何一行。
#   3. 部署前后做进度不变量校验：逐条比对 player_progress 的关键字段，不一致即判失败并自动回滚。
#   4. 不启用 Tailscale SSH、不改 nginx 现有 location（只读备份）、不碰 /qq/ 讨论站、
#      不重启与本项目无关的服务。
#
# 用法（全部通过环境变量指定，脚本内不含任何凭据）:
#   BACKUP_ROOT=/var/backups/mes \
#   APP_DIR=/workspace/app PB_PUBLIC_DIR=/workspace/app/pb_public \
#   PB_HOOKS_DIR=/workspace/app/pb_hooks SERVER_DIR=/workspace/app/server \
#   DATA_DIR=/workspace/app/pb_data NGINX_CONF_DIR=/etc/nginx \
#   SITE_URL=https://mes.nya.je SITE_PREFIX=/mes \
#   ./mes-deploy.sh --dist ./dist --hooks templates/pb_hooks --server server
#
# 可选环境变量:
#   KEEP                 备份保留份数(默认 3)
#   POCKETBASE_STOP_CMD  停止 PocketBase 的命令(例如 "systemctl stop pocketbase")
#   POCKETBASE_START_CMD 启动 PocketBase 的命令
#   POCKETBASE_RESTART_CMD 部署钩子后重启 PocketBase 的命令(留空则不重启)
#   POCKETBASE_HEALTH_URL PocketBase 健康检查地址(默认由 SITE_URL 推断)
#   SKIP_VERIFY_SITE=1   只做备份与部署，跳过站点校验(仅用于调试)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
LOG_PREFIX="[mes-deploy $(date +%H:%M:%S)]"

BACKUP_ROOT="${BACKUP_ROOT:?必须指定 BACKUP_ROOT}"
APP_DIR="${APP_DIR:?必须指定 APP_DIR}"
PB_PUBLIC_DIR="${PB_PUBLIC_DIR:-$APP_DIR/pb_public}"
PB_HOOKS_DIR="${PB_HOOKS_DIR:-$APP_DIR/pb_hooks}"
SERVER_DIR="${SERVER_DIR:-$APP_DIR/server}"
DATA_DIR="${DATA_DIR:?必须指定 DATA_DIR（PocketBase 数据目录，存档数据所在）}"
NGINX_CONF_DIR="${NGINX_CONF_DIR:-}"
SITE_URL="${SITE_URL:-}"
SITE_PREFIX="${SITE_PREFIX:-/mes}"
KEEP="${KEEP:-3}"
POCKETBASE_STOP_CMD="${POCKETBASE_STOP_CMD:-}"
POCKETBASE_START_CMD="${POCKETBASE_START_CMD:-}"
POCKETBASE_RESTART_CMD="${POCKETBASE_RESTART_CMD:-}"
SKIP_VERIFY_SITE="${SKIP_VERIFY_SITE:-0}"

DIST_DIR=""
HOOKS_DIR=""
SERVER_SRC_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dist) DIST_DIR="$2"; shift 2;;
    --hooks) HOOKS_DIR="$2"; shift 2;;
    --server) SERVER_SRC_DIR="$2"; shift 2;;
    --rollback) ROLLBACK_DIR="$2"; shift 2;;
    *) echo "未知参数: $1" >&2; exit 2;;
  esac
done
if [ -z "${ROLLBACK_DIR:-}" ]; then
  [ -n "$DIST_DIR" ] || { echo "缺少 --dist" >&2; exit 2; }
fi

BACKUP_DIR="$BACKUP_ROOT/mes-backup-$TS"
mkdir -p "$BACKUP_DIR"

log() { echo "$LOG_PREFIX $*"; }

# ---------------------------------------------------------------- 1. 备份
log "开始备份到 $BACKUP_DIR"

# 1.1 项目源码与配置
mkdir -p "$BACKUP_DIR/app" "$BACKUP_DIR/nginx"
if [ -d "$APP_DIR" ]; then
  tar -C "$APP_DIR" -cf - . 2>/dev/null | tar -C "$BACKUP_DIR/app" -xf - 2>/dev/null || true
fi
if [ -n "$NGINX_CONF_DIR" ] && [ -d "$NGINX_CONF_DIR" ]; then
  tar -C "$NGINX_CONF_DIR" -cf - . 2>/dev/null | tar -C "$BACKUP_DIR/nginx" -xf - 2>/dev/null || true
  # nginx 站点配置的独立副本，便于人工比对 /qq/ 等 location 未被改动
  if [ -d "$NGINX_CONF_DIR/sites-available" ]; then
    cp -a "$NGINX_CONF_DIR/sites-available" "$BACKUP_DIR/nginx/sites-available" 2>/dev/null || true
  fi
fi

# 1.2 存档数据本体（PocketBase 数据目录）—— 进度不变量要求备份里必须有它
mkdir -p "$BACKUP_DIR/data"
DATA_DB="$DATA_DIR/data.db"
if [ -f "$DATA_DB" ]; then
  # 用 SQLite 的 VACUUM INTO 生成一致性快照（可以在 PocketBase 运行中安全执行）
  if command -v node >/dev/null 2>&1; then
    node -e '
      const { DatabaseSync } = require("node:sqlite");
      const src = process.argv[1], dst = process.argv[2];
      const db = new DatabaseSync(src, { readOnly: true });
      // SQLite parses a double-quoted token as an identifier, so "path" fails with
      // "no such column"; the target must be a single-quoted string literal.
      // (The apostrophe is built by char code: this snippet lives inside a
      // shell single-quoted string, where a literal quote would end it.)
      const q = String.fromCharCode(39);
      const safeDst = dst.split(q).join(q + q);
      try { db.exec("VACUUM INTO " + q + safeDst + q); } finally { db.close(); }
    ' "$DATA_DB" "$BACKUP_DIR/data/data.db" 2>/dev/null \
      && log "存档数据一致性快照完成: $BACKUP_DIR/data/data.db" \
      || {
        log "VACUUM INTO 失败，退回直接复制数据文件"
        cp -a "$DATA_DB" "$BACKUP_DIR/data/data.db"
        cp -a "$DATA_DB-wal" "$BACKUP_DIR/data/data.db-wal" 2>/dev/null || true
        cp -a "$DATA_DB-shm" "$BACKUP_DIR/data/data.db-shm" 2>/dev/null || true
      }
  else
    cp -a "$DATA_DB" "$BACKUP_DIR/data/data.db"
  fi
  # 数据目录里的其余文件（辅助库、设置、通知等）
  for extra in auxiliary.db auxiliary.db-wal auxiliary.db-shm; do
    [ -f "$DATA_DIR/$extra" ] && cp -a "$DATA_DIR/$extra" "$BACKUP_DIR/data/" 2>/dev/null || true
  done
else
  log "警告: 未找到 $DATA_DB，跳过存档数据备份（请检查 DATA_DIR）"
fi

# 1.3 进度不变量基线（部署前快照，逐条记录关键字段）
PROGRESS_BEFORE="$BACKUP_DIR/progress-before.json"
if command -v node >/dev/null 2>&1 && [ -f "$DATA_DB" ]; then
  node "$SCRIPT_DIR/progress-guard.mjs" snapshot --data-dir "$DATA_DIR" --out "$PROGRESS_BEFORE" \
    && log "进度基线快照: $PROGRESS_BEFORE" \
    || log "警告: 进度基线快照失败"
fi

# 1.4 清单与标记（.policy-marker 决定这份备份是否参与保留策略）
cat > "$BACKUP_DIR/MANIFEST.txt" <<EOF
备份时间: $TS
项目目录: $APP_DIR
前端产物目录: $PB_PUBLIC_DIR
钩子目录: $PB_HOOKS_DIR
执行器目录: $SERVER_DIR
存档数据目录: $DATA_DIR
nginx 配置目录: ${NGINX_CONF_DIR:-未指定}
站点: ${SITE_URL:-未指定}${SITE_PREFIX}
本次部署来源: $DIST_DIR
EOF
touch "$BACKUP_DIR/.policy-marker"
log "备份完成: $BACKUP_DIR"

# ---------------------------------------------------------------- 2. 部署
rollback() {
  local reason="$1"
  log "开始回滚到 $BACKUP_DIR（原因: $reason）"
  # 2.1 还原本次部署覆盖的三个子树（前端产物 / 钩子 / 执行器）。
  #     只动这三个目录，绝不整目录清空 APP_DIR —— 存档数据目录 DATA_DIR 通常就在 APP_DIR 里，
  # 整目录删除会把线上学习进度一起删掉。
  restore_subtree() {
    local live="$1" rel="$2"
    [ -d "$BACKUP_DIR/app/$rel" ] || return 0
    mkdir -p "$live"
    rm -rf "${live:?}"/* 2>/dev/null || true
    tar -C "$BACKUP_DIR/app/$rel" -cf - . 2>/dev/null | tar -C "$live" -xf - 2>/dev/null || true
    log "已还原: $live"
  }
  rel_of() {
    case "$1" in
      "$APP_DIR"/*) echo "${1#"$APP_DIR"/}";;
      *) echo "";;
    esac
  }
  for target in "$PB_PUBLIC_DIR" "$PB_HOOKS_DIR" "$SERVER_DIR"; do
    rel="$(rel_of "$target")"
    [ -n "$rel" ] && restore_subtree "$target" "$rel"
  done
  # 2.2 还原 nginx 配置：覆盖式还原（不删除现网新增文件），我们本身不改 nginx
  if [ -n "$NGINX_CONF_DIR" ] && [ -d "$BACKUP_DIR/nginx" ]; then
    cp -a "$BACKUP_DIR/nginx/." "$NGINX_CONF_DIR/" 2>/dev/null || true
    log "已还原 nginx 配置副本到 $NGINX_CONF_DIR"
  fi
  # 2.3 还原存档数据（只在 PocketBase 停止的情况下覆盖，避免运行中写坏数据库）
  if [ -f "$BACKUP_DIR/data/data.db" ]; then
    if [ -n "$POCKETBASE_STOP_CMD" ] && [ -n "$POCKETBASE_START_CMD" ]; then
      log "停止 PocketBase 并还原存档数据"
      eval "$POCKETBASE_STOP_CMD" || true
      sleep 2
      cp -a "$BACKUP_DIR/data/data.db" "$DATA_DIR/data.db"
      rm -f "$DATA_DIR/data.db-wal" "$DATA_DIR/data.db-shm"
      for extra in auxiliary.db auxiliary.db-wal auxiliary.db-shm; do
        [ -f "$BACKUP_DIR/data/$extra" ] && cp -a "$BACKUP_DIR/data/$extra" "$DATA_DIR/" || true
      done
      eval "$POCKETBASE_START_CMD" || true
      sleep 3
      log "存档数据已还原并重启 PocketBase"
    else
      # 不擅自停服：把还原文件放到数据目录旁边，并给出人工步骤
      cp -a "$BACKUP_DIR/data/data.db" "$DATA_DIR/data.db.rollback-$TS" 2>/dev/null || true
      log "未配置 POCKETBASE_STOP_CMD/START_CMD，未覆盖正在使用的数据库。"
      log "请人工还原存档数据: 停止 PocketBase 后执行"
      log "  cp -a $DATA_DIR/data.db.rollback-$TS $DATA_DIR/data.db && rm -f $DATA_DIR/data.db-wal $DATA_DIR/data.db-shm && 启动 PocketBase"
    fi
  fi
  log "回滚完成，请人工确认站点状态"
}

trap 'log "执行中断"; rollback "脚本异常中断"; exit 1' ERR
# 手动回滚模式（--rollback <备份目录>）：把项目、nginx 与存档数据一并还原
if [ -n "${ROLLBACK_DIR:-}" ]; then
  [ -d "$ROLLBACK_DIR" ] || { echo "备份目录不存在: $ROLLBACK_DIR" >&2; exit 2; }
  BACKUP_DIR="$ROLLBACK_DIR"
  TS="$(basename "$BACKUP_DIR" | sed -E 's/^mes-backup-//')"
  log "手动回滚模式：还原 $BACKUP_DIR"
  rollback "手动回滚"
  exit 0
fi


log "部署前端产物到 $PB_PUBLIC_DIR"
mkdir -p "$PB_PUBLIC_DIR"
rm -rf "${PB_PUBLIC_DIR:?}/"* 2>/dev/null || true
tar -C "$DIST_DIR" -cf - . 2>/dev/null | tar -C "$PB_PUBLIC_DIR" -xf -

if [ -n "$HOOKS_DIR" ] && [ -d "$HOOKS_DIR" ]; then
  log "同步 PocketBase 钩子到 $PB_HOOKS_DIR"
  mkdir -p "$PB_HOOKS_DIR"
  cp -a "$HOOKS_DIR"/. "$PB_HOOKS_DIR"/ 2>/dev/null || true
fi
if [ -n "$SERVER_SRC_DIR" ] && [ -d "$SERVER_SRC_DIR" ]; then
  log "同步执行器到 $SERVER_DIR"
  mkdir -p "$SERVER_DIR"
  cp -a "$SERVER_SRC_DIR"/. "$SERVER_DIR"/ 2>/dev/null || true
fi

# 2.1 需要重启 PocketBase 才能加载新钩子时：先确认数据已落盘、备份已含存档数据
if [ -n "$POCKETBASE_RESTART_CMD" ]; then
  log "重启 PocketBase 以加载新钩子（存档数据已备份在 $BACKUP_DIR/data）"
  eval "$POCKETBASE_RESTART_CMD" || true
  sleep 3
fi

# ---------------------------------------------------------------- 3. 保留策略
if [ -x "$SCRIPT_DIR/backup-retention.sh" ]; then
  BACKUP_ROOT="$BACKUP_ROOT" KEEP="$KEEP" bash "$SCRIPT_DIR/backup-retention.sh" || true
fi

# ---------------------------------------------------------------- 4. 校验
log "验证站点: $SITE_URL$SITE_PREFIX"
VERIFY_FAILED=0
if [ "$SKIP_VERIFY_SITE" != "1" ] && [ -n "$SITE_URL" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$SITE_PREFIX/" || echo 000)
  if [ "$code" = "200" ]; then
    log "首页 OK (HTTP $code)"
  else
    log "首页失败 (HTTP $code)"; VERIFY_FAILED=1
  fi
  # 入口脚本与关键内容文件
  entry=$(curl -s --max-time 20 "$SITE_URL$SITE_PREFIX/" | grep -o 'src="[^"]*"' | head -1 | sed 's/src="//;s/"//' || true)
  if [ -n "$entry" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$entry" || echo 000)
    if [ "$code" = "200" ]; then log "入口脚本 OK: $entry"; else log "入口脚本失败 ($code): $entry"; VERIFY_FAILED=1; fi
  fi
  for f in content/levels/index.json content/terms.json content/career-prep/index.json; do
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$SITE_PREFIX/$f" || echo 000)
    if [ "$code" = "200" ]; then log "内容文件 OK: $f"; else log "内容文件失败 ($code): $f"; VERIFY_FAILED=1; fi
  done
  # 后端路由存活（未登录应返回 401，而不是 404）
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL$SITE_PREFIX/__pb/api/player_progress" || echo 000)
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then log "后端路由 OK (HTTP $code，需登录属预期)"; else log "后端路由异常 (HTTP $code)"; VERIFY_FAILED=1; fi
fi

# 4.1 进度不变量校验：部署后重新快照并与基线逐条比对
PROGRESS_AFTER="$BACKUP_DIR/progress-after.json"
if [ -f "$PROGRESS_BEFORE" ] && command -v node >/dev/null 2>&1; then
  log "校验学习进度不变量（部署前 → 部署后逐条比对）"
  node "$SCRIPT_DIR/progress-guard.mjs" snapshot --data-dir "$DATA_DIR" --out "$PROGRESS_AFTER" || true
  if node "$SCRIPT_DIR/progress-guard.mjs" compare --before "$PROGRESS_BEFORE" --after "$PROGRESS_AFTER"; then
    log "学习进度不变量校验通过：存档记录逐条一致"
  else
    log "学习进度不变量校验失败：存档记录出现差异，判定部署失败"
    VERIFY_FAILED=1
  fi
fi

if [ "$VERIFY_FAILED" != "0" ]; then
  trap - ERR
  rollback "部署后校验未通过"
  exit 1
fi

trap - ERR
log "部署完成并通过校验。备份目录: $BACKUP_DIR"
log "如需回滚: BACKUP_ROOT=$BACKUP_ROOT bash $SCRIPT_DIR/mes-deploy.sh --rollback $BACKUP_DIR"

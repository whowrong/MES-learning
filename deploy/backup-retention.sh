#!/usr/bin/env bash
# backup-retention.sh — MES 站备份保留策略（可重复执行）
#
# 规则（对应刘先生的硬约束）:
#   - 备份总数超过 KEEP 份时，删除最早的一份，使总数始终 <= KEEP。
#   - 项目备份与 nginx 配置备份使用同一套判定（同一目录、同一前缀、同一保留数），
#     不会出现只清一半的情况。
#   - 删除前逐份核对：该备份必须含存档数据快照（data/data.db）。没有存档数据的备份
#     一律跳过，不删 —— 避免把仅有的存档数据副本删掉。
#   - 绝不删除当前生产正在使用的数据目录（DATA_DIR）本身或其中的文件。
#   - 不属于本策略的历史备份（没有 .policy-marker / 命名不符）一律不动。
#
# 用法:
#   BACKUP_ROOT=/var/backups/mes KEEP=3 ./backup-retention.sh            # 执行
#   BACKUP_ROOT=/var/backups/mes KEEP=3 DRY_RUN=1 ./backup-retention.sh # 只演练
# 环境变量:
#   BACKUP_ROOT  备份根目录(必填)
#   KEEP         保留份数(默认 3)
#   DRY_RUN      1 = 只演练不删除
#   DATA_DIR     生产 PocketBase 数据目录(可选，用于自我保护；配了就绝不碰)
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:?必须指定 BACKUP_ROOT}"
KEEP="${KEEP:-3}"
DRY_RUN="${DRY_RUN:-0}"
DATA_DIR="${DATA_DIR:-}"
PREFIX="mes-backup-"

if [ ! -d "$BACKUP_ROOT" ]; then
  echo "[backup-retention] 备份根目录不存在: $BACKUP_ROOT" >&2
  exit 0
fi

# 自我保护：生产数据目录绝不在删除范围内
if [ -n "$DATA_DIR" ]; then
  case "$(cd "$BACKUP_ROOT" && pwd)/" in
    "$(cd "$DATA_DIR" && pwd)/"*) echo "[backup-retention] 拒绝执行: 备份根目录位于生产数据目录内" >&2; exit 1;;
  esac
fi

mapfile -t ALL < <(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -name "${PREFIX}*" -print | sort)
POLICY_BACKUPS=()
for d in "${ALL[@]}"; do
  [ -f "$d/.policy-marker" ] && POLICY_BACKUPS+=("$d")
done

COUNT=${#POLICY_BACKUPS[@]}
echo "[backup-retention] 备份根目录: $BACKUP_ROOT"
echo "[backup-retention] 本策略备份 $COUNT 份, 保留上限 $KEEP 份"
if [ "$COUNT" -le "$KEEP" ]; then
  echo "[backup-retention] 未超过保留上限, 不删除任何备份"
  exit 0
fi

DELETE_COUNT=$((COUNT - KEEP))
echo "[backup-retention] 需要删除最早的 $DELETE_COUNT 份"

# 逐份核对 + 逐份删除：每轮从最旧开始找第一份「含存档数据快照且可安全删除」的备份删掉，
# 直到磁盘上本策略备份数量回到上限内。找不到可删的就停手（宁可多留，也不误删存档数据）。
REMAINING="$COUNT"
while [ "$REMAINING" -gt "$KEEP" ]; do
  DELETED_ONE=0
  for d in "${POLICY_BACKUPS[@]}"; do
    base="$(basename "$d")"
    stamp="${base#"$PREFIX"}"
    # 逐份核对：必须是本策略产出的备份
    if [ ! -f "$d/.policy-marker" ]; then
      echo "[backup-retention] 跳过(无 marker): $d" >&2
      continue
    fi
    # 逐份核对：必须含存档数据快照，否则不删
    if [ ! -f "$d/data/data.db" ]; then
      echo "[backup-retention] 跳过(不含存档数据快照, 保留): $d" >&2
      continue
    fi
    # 自我保护：绝不删除生产数据目录本身
    if [ -n "$DATA_DIR" ]; then
      case "$(cd "$d" && pwd)/" in
        "$(cd "$DATA_DIR" && pwd)/"*) echo "[backup-retention] 跳过(位于生产数据目录内): $d" >&2; continue;;
      esac
    fi
    if [ "$DRY_RUN" = "1" ]; then
      echo "[backup-retention] [演练] 将删除: $d (时间戳 $stamp)"
    else
      rm -rf -- "$d"
      echo "[backup-retention] 已删除最旧备份: $d (时间戳 $stamp)"
    fi
    DELETED_ONE=1
    REMAINING=$((REMAINING - 1))
    break
  done
  if [ "$DELETED_ONE" != "1" ]; then
    echo "[backup-retention] 没有更多「含存档数据快照」的可删备份，停止（宁可多留也不误删）"
    break
  fi
  # 重建列表（已被删掉的目录不再参与）
  POLICY_BACKUPS=()
  for d in "${ALL[@]}"; do
    [ -d "$d" ] && [ -f "$d/.policy-marker" ] && POLICY_BACKUPS+=("$d")
  done
done

REMAIN=$(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -name "${PREFIX}*" -exec test -f '{}/.policy-marker' \; -print | wc -l)
echo "[backup-retention] 完成, 当前本策略备份 $REMAIN 份"

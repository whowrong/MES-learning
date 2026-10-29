#!/usr/bin/env bash
# backup-retention.sh — MES 站备份保留策略（可重复执行）
#
# 规则: 备份总数超过 KEEP 份时, 删除最早的一份, 使总数始终 <= KEEP。
# 判定口径:
#   - 只统计「本策略产出」的备份: 目录名形如 mes-backup-YYYYmmdd-HHMMSS 且目录内含 .policy-marker。
#   - 项目备份与 nginx 配置备份使用同一套判定(同一目录、同一前缀、同一保留数),
#     不会出现只清一半的情况。
#   - 不属于本策略的历史备份(没有 marker / 命名不符)一律不动。
#   - 删除前先确认它确实是本策略下最旧的一份(按目录名里的时间戳排序)。
#
# 用法:
#   BACKUP_ROOT=/var/backups/mes KEEP=3 ./backup-retention.sh            # 列出将删除的并执行
#   BACKUP_ROOT=/var/backups/mes KEEP=3 DRY_RUN=1 ./backup-retention.sh # 只打印不删
# 环境变量:
#   BACKUP_ROOT  备份根目录(必填)
#   KEEP         保留份数(默认 3)
#   DRY_RUN      1 = 只演练不删除
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:?必须指定 BACKUP_ROOT}"
KEEP="${KEEP:-3}"
DRY_RUN="${DRY_RUN:-0}"
PREFIX="mes-backup-"

if [ ! -d "$BACKUP_ROOT" ]; then
  echo "[backup-retention] 备份根目录不存在: $BACKUP_ROOT" >&2
  exit 0
fi

# 本策略产出的备份: 名字匹配前缀 + 含 marker; 时间戳从目录名解析(可排序)
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
for ((i = 0; i < DELETE_COUNT; i++)); do
  # 每次都取列表里最旧的一份(删完就把它从列表里摘掉)
  oldest="${POLICY_BACKUPS[0]}"
  stamp="$(basename "$oldest" | sed -E "s/^${PREFIX}//")"
  # 二次确认: 这是本策略里最早的一份(时间戳最小), 且带 marker
  if [ ! -f "$oldest/.policy-marker" ]; then
    echo "[backup-retention] 跳过(无 marker): $oldest" >&2
    continue
  fi
  if [ "$(basename "$oldest")" != "$(printf '%s\n' "${POLICY_BACKUPS[@]}" | head -1 | xargs basename)" ]; then
    echo "[backup-retention] 跳过(不是最旧一份): $oldest" >&2
    continue
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[backup-retention] [演练] 将删除: $oldest (时间戳 $stamp)"
  else
    rm -rf -- "$oldest"
    echo "[backup-retention] 已删除最旧备份: $oldest (时间戳 $stamp)"
  fi
  # 删除后从列表里移除, 下一轮再取新的最旧一份
  POLICY_BACKUPS=("${POLICY_BACKUPS[@]:1}")
done

echo "[backup-retention] 完成, 当前本策略备份 $(find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -name "${PREFIX}*" -exec test -f '{}/.policy-marker' \; -print | wc -l) 份"

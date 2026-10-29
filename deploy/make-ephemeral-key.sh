#!/usr/bin/env bash
# make-ephemeral-key.sh — 生成「一次性临时 SSH 密钥对」工具
#
# 规矩（刘先生定的死规矩）:
#   - 不接受、不索取、不使用任何既有私钥文件；这里生成的密钥对是本任务现造的、用完即焚。
#   - 只有公钥可以外发（交给刘先生去目标机 authorized_keys 追加）。
#   - 私钥只留在本机，不打印、不外放、不进仓库（默认落在仓库外的临时目录）。
#   - 用完必须撤销：--revoke 会删掉私钥文件，并打印要从 authorized_keys 里删掉的那一行注释。
#
# 用法:
#   ./make-ephemeral-key.sh                # 生成新密钥对，输出公钥与使用说明
#   ./make-ephemeral-key.sh --out /tmp/x  # 指定存放目录
#   ./make-ephemeral-key.sh --revoke <目录> # 撤销（删除私钥并打印要清理的公钥行）
set -euo pipefail

OUT_DIR=""
ACTION="create"
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="$2"; shift 2;;
    --revoke)
      ACTION="revoke"
      if [ $# -ge 2 ] && [ -n "${2:-}" ] && [ "${2:0:1}" != "-" ]; then OUT_DIR="$2"; shift 2; else shift; fi;;
    *) echo "未知参数: $1" >&2; exit 2;;
  esac
done

if [ "$ACTION" = "revoke" ]; then
  [ -n "$OUT_DIR" ] || { echo "撤销需要给出密钥目录: --revoke <目录>" >&2; exit 2; }
  KEY="$OUT_DIR/mes_today_ephemeral"
  COMMENT=$(cat "$KEY.pub" 2>/dev/null | awk '{print $3}' || true)
  if [ -f "$KEY" ]; then rm -f "$KEY"; echo "已删除私钥: $KEY"; else echo "私钥不存在（可能已撤销）: $KEY"; fi
  rm -f "$KEY.pub"
  echo "请在目标机 ~/.ssh/authorized_keys 里删掉下面这一行（以注释结尾）："
  echo "  ${COMMENT:-<该次密钥的注释>}"
  exit 0
fi

[ -n "$OUT_DIR" ] || OUT_DIR="$(mktemp -d /tmp/mes-today-key-XXXXXX)"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"
KEY="$OUT_DIR/mes_today_ephemeral"
TS="$(date +%Y%m%d-%H%M%S)"
COMMENT="mes-today-ephemeral-$TS"

if [ -f "$KEY" ]; then
  echo "该目录已有一份密钥，为避免误用请换一个目录或先 --revoke: $OUT_DIR" >&2
  exit 1
fi

ssh-keygen -t ed25519 -N "" -C "$COMMENT" -f "$KEY" >/dev/null
chmod 600 "$KEY"
chmod 644 "$KEY.pub"

echo "已生成一次性临时 SSH 密钥对（仅本机保存）"
echo
echo "① 把下面这行公钥交给刘先生，请他在目标机上追加到 ~/.ssh/authorized_keys："
cat "$KEY.pub"
echo
echo "② 私钥只在本机，路径如下（不会打印内容、不要外发、不要提交进仓库）："
echo "   $KEY"
echo
echo "③ 部署完成后撤销："
echo "   bash $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/make-ephemeral-key.sh --revoke $OUT_DIR"
echo "   然后请刘先生从 authorized_keys 删掉上面以 $COMMENT 结尾的那一行。"
echo
echo "④ 用它连目标机（私钥路径不外给任何人）："
echo "   ssh -i $KEY -o IdentitiesOnly=yes <user>@<target>"

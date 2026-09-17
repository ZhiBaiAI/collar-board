#!/usr/bin/env sh
# collar-init.sh — 模板冷启执行体：新项目复制骨架后跑一次
#
# 对应根目录 README「快速开始」的机械部分：
#   1. 删示范域 docs/specs/*业务地图*/（00_ 示例域 / 01_ 示范域）
#   2. 删示范蓝图 docs/wiki/blue-print/[技术方案]核心循环V4-MVP.md
#   3. 清空 changelog 示范条目（只留标题与说明行）
#   4. 删 docs/specs/README.md 认领表里的 ⟨示例域⟩ 示范行
#   5. 扫描剩余 ⟨⟩ 占位符列成清单（不代填——那是项目方的决策）
#   6. 跑 collar-check 收尾
#
# 默认是 dry-run（只列将做的事）；加 --yes 才真正执行删除。
# 删除目标只匹配示范命名（含「业务地图」/「示例」），不碰真实业务域。
#
# 用法（在仓库根执行）：
#   sh scripts/collar-init.sh          # 预演
#   sh scripts/collar-init.sh --yes    # 执行
#
# 退出码：0 = 完成；1 = collar-check 收尾失败

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

YES=0
[ "${1:-}" = "--yes" ] && YES=1

TARGETS=""
for D in docs/specs/*业务地图*/; do
  [ -d "$D" ] && TARGETS="$TARGETS$D "
done
DEMO_BP="docs/wiki/blue-print/[技术方案]核心循环V4-MVP.md"
[ -f "$DEMO_BP" ] && TARGETS="$TARGETS$DEMO_BP "

CFILE="docs/changelog/$(date +%Y)/$(date +%Y-%m).md"

echo "collar-init — 模板冷启"
echo

if [ "$YES" -eq 0 ]; then
  echo "[dry-run] 将执行："
  [ -n "$TARGETS" ] && printf '  删除 %s\n' $TARGETS || echo "  示范内容已清理（无删除项）"
  [ -f "$CFILE" ] && echo "  清空 $CFILE 的示范条目（保留标题与说明行）"
  echo "  清理 docs/specs/README.md 认领表示例行"
  echo "  扫描剩余 ⟨⟩ 占位符 + 跑 collar-check"
  echo
  echo "加 --yes 真正执行：sh scripts/collar-init.sh --yes"
  exit 0
fi

# 1-2) 删示范内容
for T in $TARGETS; do
  rm -rf "$T" && echo "deleted  $T"
done
[ -n "$TARGETS" ] || echo "示范内容不存在，跳过删除"

# 3) changelog 只留标题与说明行（截到第一个 ### 条目前）
if [ -f "$CFILE" ]; then
  awk '/^### /{exit} {print}' "$CFILE" > "$CFILE.tmp" && mv "$CFILE.tmp" "$CFILE"
  echo "cleaned  $CFILE（示范条目已清空）"
fi

# 4) 认领表示例行：删含 ⟨示例 的行
if grep -q '⟨示例' docs/specs/README.md 2>/dev/null; then
  sed -i '/⟨示例/d' docs/specs/README.md
  echo "cleaned  docs/specs/README.md 认领表示例行"
fi

echo
# 5) 剩余 ⟨⟩ 占位符清单（只列不填）
echo "[待填占位符] 以下文件仍有 ⟨⟩，按根目录 README 步骤 3 逐项替换："
grep -rln '⟨' AGENTS.md collar.yaml README.md docs/*/README.md docs/runbook/*.md 2>/dev/null | sort -u | \
  while IFS= read -r F; do
    N=$(grep -c '⟨' "$F")
    printf '  %-50s ×%s\n' "$F" "$N"
  done

# 6) 收尾门禁
echo
sh scripts/collar-check.sh
RC=$?

echo
if [ "$RC" -eq 0 ]; then
  echo "Next: ① 填完上面列出的 ⟨⟩ 占位符 ② git init ③ sh scripts/collar-hooks.sh 装配提交关卡"
  echo "      ④ 让 AI 读 AGENTS.md 复述「项目是什么、负责哪个 spec」——答得出来即冒烟通过"
fi
exit "$RC"

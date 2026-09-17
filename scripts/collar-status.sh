#!/usr/bin/env sh
# collar-status.sh — 知识库状态导航器
#
# 不是门禁（不拦截），是导航器：回答「现在有哪些在途事项、下一步该干什么」。
# 输出末尾的 Next: 行给出一个可执行建议。
#
# 用法（在仓库根执行）：
#   sh scripts/collar-status.sh            # 在途概览：未收敛 patch、缺口、超期项
#   sh scripts/collar-status.sh --specs    # 站点地图清单：域/功能/负责人/状态/路径
#   sh scripts/collar-status.sh --specs --json   # 机器可读（供 Agent 索引后按需读 spec）
#
# 退出码：恒 0（只读操作）

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

MODE=overview
JSON=0
for A in "$@"; do
  case "$A" in
    --specs) MODE=specs ;;
    --json)  JSON=1 ;;
    *) echo "未知参数：$A（可选 --specs / --json）" >&2; exit 1 ;;
  esac
done

field() { # 从 md 头部表取值：field <文件> <字段名>
  sed -n "s/^| *$2 *| *\([^|]*\)|.*/\1/p" "$1" 2>/dev/null | head -1 | sed 's/^ *//; s/ *$//'
}

today_s=$(date +%s)

age_days() { # $1=YYYY-MM-DD → 天数，失败返回空
  D=$(printf '%s' "$1" | sed -n 's/^\([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p')
  [ -n "$D" ] || return 0
  S=$(date -d "$D" +%s 2>/dev/null) || return 0
  echo $(( (today_s - S) / 86400 ))
}

# ---------------------------------------------------------------------------
if [ "$MODE" = specs ]; then
  if [ "$JSON" -eq 1 ]; then
    printf '['
    FIRST=1
    find docs/specs -name spec.md -not -path '*/_templates/*' -not -path '*/_archived/*' | sort | \
    while IFS= read -r SPEC; do
      DIR=$(dirname "$SPEC")
      DOM=$(basename "$(dirname "$DIR")")
      FEAT=$(basename "$DIR")
      OWNER=$(field "$SPEC" 负责人); OWNER=${OWNER:-—}
      ST=$(field "$SPEC" 状态); ST=${ST:-—}
      esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
      [ "$FIRST" -eq 1 ] || printf ','
      FIRST=0
      printf '{"domain":"%s","feature":"%s","owner":"%s","status":"%s","path":"%s"}' \
        "$(esc "$DOM")" "$(esc "$FEAT")" "$(esc "$OWNER")" "$(esc "$ST")" "$(esc "$SPEC")"
    done
    printf ']\n'
  else
    printf '%-30s %-30s %-12s %-10s %s\n' 业务域 功能 负责人 状态 路径
    find docs/specs -name spec.md -not -path '*/_templates/*' -not -path '*/_archived/*' | sort | \
    while IFS= read -r SPEC; do
      DIR=$(dirname "$SPEC")
      printf '%-30s %-30s %-12s %-10s %s\n' \
        "$(basename "$(dirname "$DIR")")" "$(basename "$DIR")" \
        "$(field "$SPEC" 负责人)" "$(field "$SPEC" 状态)" "$SPEC"
    done
  fi
  echo
  echo "Next: 按上表选定功能点后，只读对应的 spec.md + tests.md（先索引后按需，不全读）"
  exit 0
fi

# ---------------------------------------------------------------------------
echo "collar-status — 在途概览"
echo

OPEN=0

# 1) 未收敛 patch（状态不是 已收敛/已废弃）
echo "[在途 patch]"
find docs/specs -name 'PATCH-*.md' -not -path '*/_templates/*' -not -path '*/_archived/*' | sort | \
while IFS= read -r P; do
  ST=$(field "$P" 状态)
  case "$ST" in *已收敛*|*已废弃*) continue ;; esac
  EFF=$(field "$P" 生效日期)
  AGE=$(age_days "$EFF")
  AGES=${AGE:+"（生效 ${AGE} 天）"}
  FLAG=""
  if [ -n "$AGE" ] && [ "$AGE" -ge 14 ]; then
    FLAG=" ⚠ 已超收敛观察期（≥14 天），评估执行 collar-converge.sh"
  fi
  printf '  %-60s 状态=%s%s%s\n' "$P" "${ST:-?}" "$AGES" "$FLAG"
done

# 2) spec 缺口
echo
echo "[结构缺口]"
find docs/specs -name spec.md -not -path '*/_templates/*' -not -path '*/_archived/*' | sort | \
while IFS= read -r SPEC; do
  DIR=$(dirname "$SPEC")
  [ -f "$DIR/tests.md" ] || printf '  缺伴生 tests.md：%s\n' "$DIR"
  OWNER=$(field "$SPEC" 负责人)
  case "$OWNER" in *⟨*⟩*|*@谁*|"") printf '  负责人未认领：%s\n' "$SPEC" ;; esac
  grep -q '⟨' "$SPEC" && printf '  仍有 ⟨⟩ 占位符未填：%s\n' "$SPEC"
done

# 3) 日落进行中
#    归档完成判据：状态字段含「已归档」，或归档日期字段填了真实日期（非 ⟨⟩）。
#    不能全文搜「归档」——状态机里必有该词，会全部误跳过（曾经的死代码）。
echo
echo "[在途 sunset]"
find docs/specs -name 'SUNSET-*.md' -not -path '*/_templates/*' -not -path '*/_archived/*' | sort | \
while IFS= read -r S; do
  grep -q '已归档' "$S" && continue
  # 归档日期行：字段名含「归档」的表行、无任何 ⟨⟩ 占位、且值格里有真实日期
  ROW=$(grep -E '\|[^|]*归档[^|]*\|' "$S" | grep -v '⟨' | grep -E '[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
  [ -n "$ROW" ] && continue
  printf '  %s\n' "$S"
done

# 4) 模板示范残留提醒（仅当示范域仍在时提示，冷启用）
if [ -d "docs/specs/00_[业务地图]示例域" ] || [ -d "docs/specs/01_[业务地图]示范域" ]; then
  echo
  echo "[模板残留]"
  echo "  示范域 00_/01_ 仍在——若是冷启后的真实项目，按 README「落地清理清单」删除"
fi

echo
echo "Next: 处理完上列事项后，跑 sh scripts/collar-check.sh 过结构门禁再提交"
exit 0

#!/usr/bin/env sh
# collar-new.sh — 从模板新建变更（feature / patch / sunset）
#
# 契约声明在 collar.yaml 的 boundary（docs/specs/** 可写）；本脚本是「变更落盘」
# 的执行体，只复制模板并自动编号，内容仍由 Agent/人按模板填。
#
# 用法（在仓库根执行）：
#   sh scripts/collar-new.sh feature  docs/specs/NN_[业务地图]域 功能名
#   sh scripts/collar-new.sh patch    docs/specs/NN_[业务地图]域/NN_功能 简述
#   sh scripts/collar-new.sh sunset   docs/specs/NN_[业务地图]域/NN_功能 简述
#   sh scripts/collar-new.sh proposal docs/specs/NN_[业务地图]域/NN_功能 简述
#
# 退出码：0 = 已创建；1 = 参数或路径错误

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

die() { printf 'ERR  %s\n' "$1" >&2; exit 1; }
note() { printf '  %s\n' "$1"; }

TYPE="${1:-}"
TARGET="${2:-}"
NAME="${3:-}"

[ -n "$TYPE" ] && [ -n "$TARGET" ] && [ -n "$NAME" ] || {
  echo "用法："
  echo "  sh scripts/collar-new.sh feature  <域目录> <功能名>"
  echo "  sh scripts/collar-new.sh patch    <功能目录> <简述>"
  echo "  sh scripts/collar-new.sh sunset   <功能目录> <简述>"
  echo "  sh scripts/collar-new.sh proposal <功能目录> <简述>"
  exit 1
}
[ -d "$TARGET" ] || die "目标目录不存在：$TARGET（feature 传域目录，patch/sunset 传功能目录）"
case "$TARGET" in docs/specs/*) ;; *) die "目标必须在 docs/specs/ 下：$TARGET";; esac

case "$TYPE" in
  feature)
    LAST=$(ls "$TARGET" 2>/dev/null | grep -o '^[0-9][0-9]' | sort -n | tail -1)
    NN=$(printf '%02d' "$((${LAST:-0} + 1))")
    DIR="$TARGET/${NN}_${NAME}"
    [ -e "$DIR" ] && die "已存在：$DIR"
    mkdir -p "$DIR"
    cp docs/specs/_templates/feature.md "$DIR/spec.md" || die "缺模板 docs/specs/_templates/feature.md"
    cp docs/specs/_templates/tests.md  "$DIR/tests.md" || die "缺模板 docs/specs/_templates/tests.md"
    echo "created  $DIR/"
    note "  $DIR/spec.md"
    note "  $DIR/tests.md"
    echo
    echo "Next: 填 spec.md 的 ⟨⟩ 占位符（准入四问 / AC-N 验收标准 / 实施任务），"
    echo "      并在 docs/specs/README.md 认领表登记本功能点"
    ;;
  patch|sunset|proposal)
    UP=$(printf '%s' "$TYPE" | tr 'a-z' 'A-Z')
    [ -f "$TARGET/spec.md" ] || note "warn: $TARGET/spec.md 不存在，确认传的是功能目录"
    LAST=$(ls "$TARGET" 2>/dev/null | sed -n "s/^${UP}-\([0-9][0-9][0-9]\)-.*/\1/p" | sort -n | tail -1)
    NNN=$(printf '%03d' "$((${LAST:-0} + 1))")
    FILE="$TARGET/${UP}-${NNN}-${NAME}.md"
    [ -e "$FILE" ] && die "已存在：$FILE"
    cp "docs/specs/_templates/${TYPE}.md" "$FILE" || die "缺模板 docs/specs/_templates/${TYPE}.md"
    echo "created  $FILE"
    echo
    if [ "$TYPE" = patch ]; then
      echo "Next: 填 patch 的 ⟨⟩ 占位符（覆盖范围 / Delta 验收标准 / 实施任务），"
      echo "      并回到 spec.md 对应章节加「已被 PATCH-${NNN} 取代」反向指针（结构门禁 S5 必查）"
    elif [ "$TYPE" = sunset ]; then
      echo "Next: 填 sunset 的状态机（评估→预告→双写/灰度→切流→观察→归档）与回滚口径"
    else
      echo "Next: 填 proposal 的 ⟨⟩ 占位符；审阅通过后由 collar-specs 转为 feature/patch 落库"
    fi
    ;;
  *)
    die "未知类型：$TYPE（可选 feature / patch / sunset / proposal）"
    ;;
esac

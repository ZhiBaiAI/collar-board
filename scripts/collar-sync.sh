#!/usr/bin/env sh
# collar-sync.sh — 模板升级执行体：从上游 collar-sdd 拉取机械资产
#
# 下游项目复制模板后，上游仍在演进。按「谁拥有这文件」分三层跟进：
#   ① 机械资产 → 直接覆盖：scripts/ skills/ docs/specs/_templates/ VERSION
#      （下游不该改这些文件——改了就自己背维护；本脚本会告警本地改动）
#   ② 骨架文档 → 只生成 diff 报告：docs/runbook/ docs/*/README.md AGENTS.md collar.yaml
#      （协议类文件下游可能定制过，不自动合，列清单人工挑）
#   ③ 项目自有 → 不碰：AGENTS.md 已填内容、collar.yaml、docs/specs/ 业务内容、
#      docs/changelog/、src/
#
# 用法（在仓库根执行）：
#   sh scripts/collar-sync.sh                    # 从 collar remote 拉 main
#   sh scripts/collar-sync.sh --ref v1.2.0       # 指定上游 tag/分支/commit
#   sh scripts/collar-sync.sh --remote <url>     # 换上游源（如内部 fork）
#   sh scripts/collar-sync.sh --yes              # ①类文件有本地改动也照覆盖
#
# 退出码：0 = 同步完成；1 = 参数/git 错误/需确认

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

die() { printf 'ERR  %s\n' "$1" >&2; exit 1; }

UPSTREAM_URL="https://github.com/ZhiBaiAI/collar-sdd.git"
REMOTE="collar"
REF=""
YES=0
OVERWRITE="scripts/ skills/ docs/specs/_templates/ VERSION"
REVIEW="docs/runbook docs/README.md docs/specs/README.md docs/changelog/README.md docs/architecture/README.md docs/vendor/README.md docs/wiki/README.md AGENTS.md collar.yaml"

while [ $# -gt 0 ]; do
  case "$1" in
    --ref)    REF="${2:-}"; shift 2 ;;
    --remote) UPSTREAM_URL="${2:-}"; shift 2 ;;
    --yes)    YES=1; shift ;;
    *)        die "未知参数：$1（支持 --ref / --remote / --yes）" ;;
  esac
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "不在 git 仓库内——collar-sync 需要在 git 仓库里运行"

# 1) 上游 remote：已有 collar remote 直接复用，没有则添加
if git remote get-url "$REMOTE" >/dev/null 2>&1; then
  UPSTREAM_URL=$(git remote get-url "$REMOTE")
else
  git remote add "$REMOTE" "$UPSTREAM_URL" || die "git remote add 失败"
  echo "added   remote $REMOTE → $UPSTREAM_URL"
fi
git fetch "$REMOTE" --tags --quiet || die "git fetch $REMOTE 失败——检查网络与 URL"

# 2) 解析目标 ref：默认 collar/HEAD（main 或 master）
if [ -z "$REF" ]; then
  if git rev-parse --verify "$REMOTE/main" >/dev/null 2>&1; then REF="$REMOTE/main"
  elif git rev-parse --verify "$REMOTE/master" >/dev/null 2>&1; then REF="$REMOTE/master"
  else die "找不到 $REMOTE/main 或 $REMOTE/master——用 --ref 显式指定"
  fi
fi
git rev-parse --verify "$REF" >/dev/null 2>&1 || die "ref 不存在：$REF"

OLD_VER=$(cat VERSION 2>/dev/null || echo "?")
NEW_VER=$(git show "$REF:VERSION" 2>/dev/null || echo "?")
NEW_SHA=$(git rev-parse --short "$REF")

echo "collar-sync — 模板升级"
echo "  上游：$UPSTREAM_URL"
echo "  版本：$OLD_VER → $NEW_VER（$REF @ $NEW_SHA）"
echo

# 3) ①类本地改动告警：下游不该改机械资产，改了要被覆盖
DIRTY=$(git status --porcelain $OVERWRITE 2>/dev/null | grep -v '^??' || true)
if [ -n "$DIRTY" ] && [ "$YES" -eq 0 ]; then
  echo "①类机械资产存在本地改动（将被上游覆盖）："
  printf '%s\n' "$DIRTY" | sed 's/^/  /'
  echo
  echo "建议把本地修改上游化（提给 collar-sdd），或确认放弃后加 --yes 重跑。"
  exit 1
fi

# 4) 覆盖①类（逐路径校验存在性——上游还没有该文件时跳过而非整体失败；
#    整个 {...} 复合命令先完整解析再执行，覆盖 scripts/ 自身也安全；
#    上游已删的文件同步删除）
{
  for P in $OVERWRITE; do
    if git cat-file -e "$REF:$P" 2>/dev/null; then
      git checkout "$REF" -- "$P" || die "checkout $P 失败"
    fi
  done
  git diff --name-only --diff-filter=D HEAD "$REF" -- $OVERWRITE | \
    while IFS= read -r F; do
      [ -n "$F" ] && git rm -q "$F" 2>/dev/null && echo "removed  $F（上游已删）"
    done
}
echo "synced  ①类机械资产 ← $REF"

# 5) ②类骨架文档 diff 报告（只列不合）
echo
echo "[骨架文档变化] 以下文件上游有更新，但不自动合并（你可能定制过）——逐个人工挑："
STALE=0
for P in $REVIEW; do
  if git diff --quiet HEAD "$REF" -- "$P" 2>/dev/null; then :; else
    git diff --stat HEAD "$REF" -- "$P" | sed 's/^/  /' | head -2
    STALE=1
  fi
done
[ "$STALE" -eq 0 ] && echo "  （无差异）"
[ "$STALE" -eq 1 ] && echo "  查看：git diff HEAD $REF -- <文件>"

# 6) 收尾门禁
echo
if [ -f scripts/collar-check.sh ]; then
  sh scripts/collar-check.sh
fi

echo
echo "Next: ① 审上面的 ②类 diff 挑需要的内容抄进本地 ② 记 changelog 条目 ③ git commit"
echo "      （本次覆盖的文件已在暂存区——review 后一次提交即可）"

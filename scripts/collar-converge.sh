#!/usr/bin/env sh
# collar-converge.sh — patch 收敛执行体：把 patch §⑥ 的 Delta 机械合并进 spec.md
#
# 收敛规则见 docs/specs/README.md「patch 的收敛」：并存是过渡不是常态。
# 本脚本只做**可机械判定**的部分：
#   MODIFIED → 替换 spec.md 中同编号 `AC-N` 行为新文本
#   REMOVED  → spec.md 中该 AC 行作废（留墓碑注释，编号不复用）
#   RENAMED  → spec.md 中该 AC 行的编号替换为新号（FROM→TO，正文不动）
#   ADDED    → 追加到 spec.md 最后一条 AC 之后（保留 AC-P 编号，tests.md 回指不断）
#   收尾     → patch 状态改「已收敛」并顶部标注，文件保留作历史（不删除）
#
# **不由脚本做**（交人/Agent 决策，脚本只列清单）：
#   主文档被取代章节的正文合并、取代标记移除、tests.md 清理、changelog 记录。
#
# 用法（在仓库根执行）：
#   sh scripts/collar-converge.sh docs/specs/…/PATCH-NNN-简述.md
#
# 退出码：0 = 已收敛；1 = 前置检查失败（未改动任何文件）

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

die() { printf 'ERR  %s\n' "$1" >&2; exit 1; }

PATCH="${1:-}"
[ -n "$PATCH" ] || die "用法：sh scripts/collar-converge.sh <PATCH-NNN-*.md 路径>"
[ -f "$PATCH" ] || die "文件不存在：$PATCH"
case "$PATCH" in docs/specs/*PATCH-[0-9][0-9][0-9]-*.md) ;; *) die "路径必须是 docs/specs/…/PATCH-NNN-*.md：$PATCH";; esac

DIR=$(dirname "$PATCH")
SPEC="$DIR/spec.md"
[ -f "$SPEC" ] || die "同目录无 spec.md：$SPEC"
grep -q '### \(ADDED\|MODIFIED\|REMOVED\|RENAMED\)' "$PATCH" || die "$PATCH 没有 §⑥ Delta 小节（ADDED/MODIFIED/REMOVED/RENAMED），请先按新模板补齐"

BASE=$(basename "$PATCH" .md)
DATE=$(date +%Y-%m-%d)

# --- 前置校验：MODIFIED/REMOVED/RENAMED(FROM) 的 AC 必须在 spec.md 存在，
#    RENAMED(TO) 必须不存在，FROM/TO 必须成对 -------------------------------
BADCHECK=0
while IFS="$(printf '\t')" read -r KIND AC; do
  case "$KIND" in
    CHK) grep -q "\`${AC}\`" "$SPEC" || { printf 'ERR  %s 引用的 %s 在 %s 不存在\n' "$PATCH" "$AC" "$SPEC" >&2; BADCHECK=1; } ;;
    NEW) grep -q "\`${AC}\`" "$SPEC" && { printf 'ERR  RENAMED TO 的 %s 在 %s 已存在——TO 必须是新编号\n' "$AC" "$SPEC" >&2; BADCHECK=1; } ;;
    ERR) printf 'ERR  %s\n' "$AC" >&2; BADCHECK=1 ;;
  esac
done <<DELTACHECK
$(awk '
  /^###[ ]+MODIFIED/ {m="C"; next}
  /^###[ ]+REMOVED/  {m="C"; next}
  /^###[ ]+RENAMED/  {m="R"; next}
  /^###/ || /^## /   { if (m=="R" && pend!="") print "ERR\tFROM: `" pend "` 没有配对的 TO:"; m=""; pend="" }
  m=="C" && match($0, /`AC-[0-9]+`/) { print "CHK\t" substr($0,RSTART+1,RLENGTH-2); next }
  m=="R" && match($0,/^-[ ]*FROM:[ ]*`AC-[A-Za-z0-9-]+`/) {
    id=$0; sub(/^[^`]*`/,"",id); sub(/`.*/,"",id)
    if (pend!="") print "ERR\tFROM: `" pend "` 没有配对的 TO:"
    pend=id; print "CHK\t" id; next
  }
  m=="R" && match($0,/^-[ ]*TO:[ ]*`AC-[A-Za-z0-9-]+`/) {
    id=$0; sub(/^[^`]*`/,"",id); sub(/`.*/,"",id)
    if (pend=="") print "ERR\tTO: `" id "` 没有配对的 FROM:"
    else { print "NEW\t" id; pend="" }
    next
  }
  END { if (pend!="") print "ERR\tFROM: `" pend "` 没有配对的 TO:" }
' "$PATCH")
DELTACHECK
[ "$BADCHECK" -eq 0 ] || die "修正上述编号/配对问题后再收敛（结构门禁 S5 也会拦截该项）"

# --- 提取 Delta 为 TSV：类型 \t 编号 \t 文本 -------------------------------
TSV=$(awk '
  /^###[ ]+ADDED/    {m="ADDED"; next}
  /^###[ ]+MODIFIED/ {m="MOD";   next}
  /^###[ ]+REMOVED/  {m="REM";   next}
  /^###[ ]+RENAMED/  {m="REN";   next}
  /^###/ || /^## /   {m=""}
  m=="ADDED" && match($0, /`AC-P[0-9]+-[0-9]+`/) {
    ac=substr($0,RSTART+1,RLENGTH-2); txt=substr($0,RSTART+RLENGTH)
    sub(/^ */,"",txt); print "ADDED\t" ac "\t" txt
  }
  m=="MOD" && match($0, /`AC-[0-9]+`/) {
    ac=substr($0,RSTART+1,RLENGTH-2); txt=substr($0,RSTART+RLENGTH)
    sub(/^ */,"",txt); print "MOD\t" ac "\t" txt
  }
  m=="REM" && match($0, /`AC-[0-9]+`/) {
    ac=substr($0,RSTART+1,RLENGTH-2); txt=substr($0,RSTART+RLENGTH)
    sub(/^ */,"",txt); print "REM\t" ac "\t" txt
  }
  m=="REN" && match($0,/^-[ ]*FROM:[ ]*`AC-[A-Za-z0-9-]+`/) {
    f=$0; sub(/^[^`]*`/,"",f); sub(/`.*/,"",f); next
  }
  m=="REN" && match($0,/^-[ ]*TO:[ ]*`AC-[A-Za-z0-9-]+`/) {
    t=$0; sub(/^[^`]*`/,"",t); sub(/`.*/,"",t)
    if (f!="") { print "REN\t" f "\t" t; f="" }
    next
  }
' "$PATCH")

[ -n "$TSV" ] || die "Delta 小节存在但没有可解析的 AC 条目"

# --- 机械合并进 spec.md -----------------------------------------------------
TMP="$SPEC.converge.tmp"
printf '%s\n' "$TSV" | awk -v patch="$BASE" '
  NR==FNR {
    t=$1; ac=$2; sub(/^[^\t]*\t[^\t]*\t/,""); txt=$0
    if (t=="MOD") mod[ac]=txt
    else if (t=="REM") rem[ac]=1
    else if (t=="REN") ren[ac]=txt
    else if (t=="ADDED") { addn++; addac[addn]=ac; addtxt[addn]=txt }
    next
  }
  { sl++; lines[sl]=$0; if ($0 ~ /^- \[.\] `AC-[0-9]+`/) lastac=sl }
  END {
    for (i=1; i<=sl; i++) {
      l=lines[i]
      if (match(l,/^- \[.\] `AC-[0-9]+`/)) {
        match(l, /`AC-[0-9]+`/)
        ac=substr(l,RSTART+1,RLENGTH-2)
        if (ac in rem) { print "<!-- " ac " 已由 " patch " 作废 -->"; continue }
        if (ac in mod) { sub(/`AC-[0-9]+`.*/, "`" ac "` " mod[ac], l) }
        if (ac in ren) { sub(/`AC-[0-9]+`/, "`" ren[ac] "`", l) }
      }
      print l
      if (i==lastac) for (j=1;j<=addn;j++) print "- [ ] `" addac[j] "` " addtxt[j]
    }
  }
' - "$SPEC" > "$TMP" && mv "$TMP" "$SPEC"

# --- patch 收尾：状态改已收敛 + 顶部标注 -----------------------------------
# 不用 sed -i：BSD sed（macOS）把下一个参数当备份后缀，GNU 写法会直接失败。
awk -v d="$DATE" -v s="$SPEC" '
  NR==1 { print; print ""; print "> 已收敛 → 并入 " s "（" d "），本文件保留作历史。"; next }
  /^\| 状态 \|/ { print "| 状态 | 已收敛 |"; next }
  { print }
' "$PATCH" > "$PATCH.tmp" && mv "$PATCH.tmp" "$PATCH"

echo "converged  $PATCH → $SPEC"
printf '%s\n' "$TSV" | awk -F'\t' '{print "  " $1 "  " $2}'
echo
echo "剩余手工项（脚本不代决策）："
echo "  1. 把 patch §③ 的正文合入 spec.md 被取代章节，并移除「已被 ${BASE} 取代」标记块"
echo "  2. tests.md：REMOVED 的 AC 对应测试点标作废（记录保留）；MODIFIED 的核对判定文本；RENAMED 的回指改新编号"
echo "  3. spec.md「变更历史」表本 patch 行补记收敛日期"
echo "  4. docs/changelog/ 记一条收敛记录"
echo
echo "Next: sh scripts/collar-check.sh 验证结构门禁"
exit 0

#!/usr/bin/env sh
# collar-check.sh — 结构门禁（语言无关，只依赖 POSIX sh + grep/find/wc）
#
# 契约声明在 collar.yaml 的 validation.gates；本脚本是其中一个执行体。
# 与 lint / typecheck / test 这类语言相关门禁不同，本脚本检查的是
# 知识库自身的结构完整性，复制模板即生效，无需按技术栈装配。
#
# 用法：sh scripts/collar-check.sh   （在仓库根执行；CI 与 pre-commit 均可挂）
# 退出码：0 = 全部通过；1 = 有失败项（逐条列出）

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

FAIL=0
note() { printf '  %s\n' "$1"; }
fail() { FAIL=1; printf 'FAIL %s\n' "$1"; note "修法：$2"; }
pass() { printf 'ok   %s\n' "$1"; }

echo "collar-check — 结构门禁"
echo "repo: $ROOT"
echo

# ---------------------------------------------------------------------------
# S0 核心结构存在性：骨架文件缺失时其余检查全部失去意义，先拦
#    （grep 2>/dev/null 会静默吞掉「文件不存在」，缺骨架必须显式失败）
# ---------------------------------------------------------------------------
S0_BROKEN=0
for REQUIRED in AGENTS.md collar.yaml VERSION docs/README.md docs/specs/README.md \
                docs/runbook/commit-gate.md docs/runbook/conventions.md \
                docs/architecture/README.md scripts/collar-check.sh; do
  if [ ! -f "$REQUIRED" ]; then
    S0_BROKEN=1
    fail "S0 核心文件缺失" "${REQUIRED} 不存在——恢复该文件（模板原样或从 git 历史找回）"
  fi
done
for REQUIRED_DIR in docs/specs docs/runbook docs/architecture docs/changelog; do
  if [ ! -d "$REQUIRED_DIR" ]; then
    S0_BROKEN=1
    fail "S0 核心目录缺失" "${REQUIRED_DIR}/ 不存在——恢复该目录（六模块结构缺一不可）"
  fi
done
[ "$S0_BROKEN" -eq 0 ] && pass "S0 模板骨架完整（核心文件与目录齐全）"

# ---------------------------------------------------------------------------
# S1 入口地图行数：AGENTS.md ≤ 120 行
# ---------------------------------------------------------------------------
LINES=$(wc -l < AGENTS.md | tr -d ' ')
if [ "$LINES" -le 120 ]; then
  pass "S1 AGENTS.md = ${LINES} 行 (≤120)"
else
  fail "S1 AGENTS.md = ${LINES} 行 (>120)" \
       "把细节迁到 docs/ 对应模块，入口只留一行摘要 + 链接"
fi

# ---------------------------------------------------------------------------
# S2 spec.md 必须有伴生 tests.md（只查业务域，跳过 _templates/_archived）
# ---------------------------------------------------------------------------
MISSING_T=""
# find 输出含空格路径会被 for 按空白分词 → 用 heredoc 逐行读入
while IFS= read -r SPEC; do
  [ -n "${SPEC}" ] || continue
  DIR=$(dirname "${SPEC}")
  [ -f "${DIR}/tests.md" ] || MISSING_T="${MISSING_T} ${SPEC}"
done <<FINDLIST
$(find docs/specs -name spec.md -not -path '*/_templates/*' -not -path '*/_archived/*')
FINDLIST
if [ -z "$MISSING_T" ]; then
  pass "S2 每个 spec.md 都有同目录 tests.md"
else
  fail "S2 以下 spec.md 缺伴生 tests.md" "每个功能点必须有测试文档（复制 docs/specs/_templates/tests.md）:${MISSING_T}"
fi

# ---------------------------------------------------------------------------
# S3 AC 双向对齐：spec 的 AC-N 与 tests.md 的回指互相覆盖
#    spec 声明而 tests 未回指 → 缺口；tests 回指而 spec 未声明 → 悬空引用
# ---------------------------------------------------------------------------
S3_BROKEN=0
while IFS= read -r PAIR_DIR; do
  [ -n "${PAIR_DIR}" ] || continue
  SPEC_AC=$(grep -o 'AC-[0-9][0-9]*' "${PAIR_DIR}/spec.md" 2>/dev/null | sort -u | tr '\n' ',')
  TESTS_AC=$(grep -oh 'AC-[0-9][0-9]*' "${PAIR_DIR}/tests.md" "${PAIR_DIR}"/PATCH-*.md 2>/dev/null | sort -u | tr '\n' ',')
  # patch 引入的 AC-PNNN-N 细化主文档 AC-N，属合法覆盖，这里只对齐 AC-N 本身
  # 注：字符串内变量一律 ${...} 包裹——部分 sh 会把紧跟变量的全角标点首字节并进变量名
  for AC in ${SPEC_AC}; do
    case ",${TESTS_AC}," in
      *",${AC},"*) ;;
      *) S3_BROKEN=1; fail "S3 ${PAIR_DIR}" "spec 声明了 ${AC}，但 tests.md（含 patch）没有任何测试点回指它 → 登记缺口或补测试点" ;;
    esac
  done
  for AC in ${TESTS_AC}; do
    case ",${SPEC_AC}," in
      *",${AC},"*) ;;
      *) S3_BROKEN=1; fail "S3 ${PAIR_DIR}" "tests.md/patch 引用了 ${AC}，但 spec.md 没有这条编号 → 补 AC 或修正编号" ;;
    esac
  done
done <<FINDLIST
$(find docs/specs -name spec.md -not -path '*/_templates/*' -not -path '*/_archived/*' -exec dirname {} \;)
FINDLIST
[ "$S3_BROKEN" -eq 0 ] && pass "S3 AC-N 双向对齐（spec ↔ tests/patch）"

# ---------------------------------------------------------------------------
# S4 ADR 编号唯一：docs/architecture/ADR/NNNN-*.md 前缀不得重复
# ---------------------------------------------------------------------------
DUP=$(ls docs/architecture/ADR 2>/dev/null | grep -o '^[0-9]\{4\}' | sort | uniq -d)
if [ -z "$DUP" ]; then
  pass "S4 ADR 编号唯一"
else
  fail "S4 ADR 编号重复" "重复前缀：$DUP —— 决策只增不改，新决策用下一个编号"
fi

# ---------------------------------------------------------------------------
# S5 patch 双向指针 + Delta 一致性：patch 有「覆盖范围」节、主文档有取代标记；
#    §⑥ delta 校验引用存在性、RENAMED 配对/新号、跨小节冲突、段外孤儿行、标题拼错
# ---------------------------------------------------------------------------
S5_BROKEN=0
# find 输出含空格路径会被 for 按空白分词 → 用 heredoc 逐行读入；
# 不用管道（while 在子 shell 里跑，FAIL 标志无法传播）
while IFS= read -r PATCH; do
  [ -n "${PATCH}" ] || continue
  DIR=$(dirname "${PATCH}")
  BASE=$(basename "${PATCH}" .md)   # PATCH-001-分页策略
  NUM=$(printf '%s' "${BASE}" | sed 's/^PATCH-\([0-9]\{3\}\)-.*/\1/')
  # 文件名必须符合 PATCH-NNN-简述：编号提取失败（NUM 未变化）说明命名违规，
  # 此时反向指针检查失去依据，报格式错误并跳过本文件的指针检查
  if [ "${NUM}" = "${BASE}" ] || ! printf '%s' "${NUM}" | grep -q '^[0-9]\{3\}$'; then
    S5_BROKEN=1
    fail "S5 ${PATCH}" "patch 文件名不符合 PATCH-NNN-简述 约定（NNN 为三位数字）——改名为 PATCH-NNN-简述.md 后重查"
    continue
  fi
  grep -q '覆盖范围' "${PATCH}" || { S5_BROKEN=1; fail "S5 ${PATCH}" "缺少「① 覆盖范围」节——按 _templates/patch.md 补上 Patch → 主文档指针"; }
  # 主文档侧：spec.md 应出现 PATCH-<NUM> 的取代标记
  if ! grep -q "已被.*PATCH-${NUM}" "$DIR/spec.md" 2>/dev/null; then
    S5_BROKEN=1
    fail "S5 ${DIR}/spec.md" "存在 ${BASE} 但主文档没有「已被 …PATCH-${NUM}…取代」反向指针——在主文档目标章节加取代标记（见 patch 模板 §⑤）"
  fi
  # Delta 一致性（一次 awk 全查，输出 KIND\t数据 由下方循环分发）：
  #   CHK  需存在于主文档的编号（MODIFIED / REMOVED / RENAMED FROM）
  #   NEW  不得存在于主文档的编号（RENAMED TO）
  #   ERR  结构错误：小节内重复 / 跨小节同编号 / FROM-TO 不配对 /
  #        段外 AC 孤儿行 / 疑似拼错的小节标题
  while IFS="$(printf '\t')" read -r KIND REST; do
    [ -n "${KIND}" ] || continue
    case "${KIND}" in
      CHK) grep -q "\`${REST}\`" "${DIR}/spec.md" 2>/dev/null || {
             S5_BROKEN=1
             fail "S5 ${PATCH}" "delta 引用的 ${REST} 在主文档 §5 不存在——核对编号（可能打错、已被移除或被 RENAMED 改名）"
           } ;;
      NEW) grep -q "\`${REST}\`" "${DIR}/spec.md" 2>/dev/null && {
             S5_BROKEN=1
             fail "S5 ${PATCH}" "RENAMED TO 的 ${REST} 在主文档已存在——TO 必须换新编号（通常用 AC-PNNN-N）"
           } ;;
      ERR) S5_BROKEN=1; fail "S5 ${PATCH}" "${REST}" ;;
    esac
  done <<DELTACHECK
$(awk '
  /^###[ ]+/ {
    if (sec=="RENAMED" && pend!="") { printf "ERR\t### RENAMED 里 FROM: `%s` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）\n", pend; pend="" }
    hdr=$0; sub(/^###[ ]+/,"",hdr); sub(/[ ]+$/,"",hdr)
    if (hdr=="ADDED"||hdr=="MODIFIED"||hdr=="REMOVED"||hdr=="RENAMED") { sec=hdr }
    else {
      sec=""; up=toupper(hdr)
      if (up ~ /^ADD|^MODI|^REMO|^RENA/) printf "ERR\t小节标题「### %s」疑似拼错——delta 小节只认 ADDED/MODIFIED/REMOVED/RENAMED（若非笔误请改标题或层级）\n", hdr
    }
    next
  }
  /^## / {
    if (sec=="RENAMED" && pend!="") { printf "ERR\t### RENAMED 里 FROM: `%s` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）\n", pend; pend="" }
    sec=""; next
  }
  sec=="RENAMED" && match($0,/^-[ ]*FROM:[ ]*`AC-[A-Za-z0-9-]+`/) {
    id=$0; sub(/^[^`]*`/,"",id); sub(/`.*/,"",id)
    if (pend!="") printf "ERR\t### RENAMED 里 FROM: `%s` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）\n", pend
    pend=id; mark(id,"RENAMED(FROM)"); printf "CHK\t%s\n", id; next
  }
  sec=="RENAMED" && match($0,/^-[ ]*TO:[ ]*`AC-[A-Za-z0-9-]+`/) {
    id=$0; sub(/^[^`]*`/,"",id); sub(/`.*/,"",id)
    if (pend=="") printf "ERR\t### RENAMED 里 TO: `%s` 没有配对的 FROM:\n", id
    else pend=""
    if (id !~ /^AC-P[0-9]+-[0-9]+$/) printf "ERR\tRENAMED TO 的 `%s` 必须是 AC-PNNN-N 形编号——普通 AC-N 会撞主文档编号体系并触发 S3 悬空引用\n", id
    mark(id,"RENAMED(TO)"); printf "NEW\t%s\n", id; next
  }
  sec!="" && sec!="RENAMED" && match($0,/^-[ ]*(\[[ xX]\][ ]*)?`AC-[A-Za-z0-9-]+`/) {
    id=$0; sub(/^[^`]*`/,"",id); sub(/`.*/,"",id)
    mark(id,sec); if (sec!="ADDED") printf "CHK\t%s\n", id
    next
  }
  sec=="" && match($0,/^-[ ]*(\[[ xX]\][ ]*)?`AC-[A-Za-z0-9-]+`/) {
    printf "ERR\tAC 条目不在 delta 小节内会被收敛忽略：%s（移进对应 ### 小节）\n", $0
  }
  sec=="" && match($0,/^-[ ]*(FROM|TO):[ ]*`AC-[A-Za-z0-9-]+`/) {
    printf "ERR\tFROM:/TO: 行不在 ### RENAMED 小节内会被忽略：%s\n", $0
  }
  function mark(ac, s) {
    if (++cnt[s,ac]>1) printf "ERR\t`%s` 在 %s 小节内重复——同一编号只留一条\n", ac, s
    if (index(seclist[ac], s)==0) seclist[ac]=(seclist[ac]==""?s:seclist[ac] "|" s)
  }
  END {
    if (pend!="") printf "ERR\t### RENAMED 里 FROM: `%s` 没有配对的 TO:（每条 FROM: 紧跟一条 TO:）\n", pend
    for (ac in seclist) {
      n=split(seclist[ac],p,"|")
      if (n>1) printf "ERR\t编号 `%s` 跨多个 delta 小节出现（%s）——一个 AC 只能属于一种操作\n", ac, seclist[ac]
    }
  }
' "${PATCH}")
DELTACHECK
done <<FINDLIST
$(find docs/specs -name 'PATCH-*.md' -not -path '*/_templates/*' -not -path '*/_archived/*')
FINDLIST
[ "$S5_BROKEN" -eq 0 ] && pass "S5 patch 双向指针 + Delta 一致性"

# ---------------------------------------------------------------------------
# S6 changelog 联动：改了 docs/specs/**（业务域）则同一次提交必须也改 changelog
#    「存在旧条目」不算通过——要求 changelog 也在本次暂存区里，
#    否则模板自带的示范条目会让检查恒真（门禁等于没装）。
#    仅在有 git 且非空提交的场景检查；cold-start 前自动跳过
# ---------------------------------------------------------------------------
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  MONTH=$(date +%Y-%m)
  MONTHFILE="docs/changelog/$(date +%Y)/${MONTH}.md"
  # core.quotePath=false：否则 git 把非 ASCII 路径转义成 "\345\237\237"，
  # 模板目录名默认含中文，前缀匹配会全部失效（门禁静默恒真）
  STAGED=$(git -c core.quotePath=false diff --cached --name-only 2>/dev/null)
  SPEC_CHANGED=$(printf '%s\n' "$STAGED" | grep '^docs/specs/.*/[0-9][0-9]_' || true)
  if [ -n "$SPEC_CHANGED" ]; then
    if printf '%s\n' "$STAGED" | grep -q '^docs/changelog/.*\.md$'; then
      pass "S6 变更了 specs，changelog 已同次提交"
    else
      fail "S6 变更了 specs 但 changelog 未同次提交" \
           "在 ${MONTHFILE} 记一条并 git add（一次提交 = 一条记录，collar-changelog 负责）"
    fi
  else
    pass "S6 未变更 specs（changelog 检查跳过）"
  fi
else
  note "S6 无 git 历史（cold-start），跳过 changelog 联动检查"
fi

# ---------------------------------------------------------------------------
# S7 现状文档只写现在时：禁用绑定「过去某次会话」的指代词
#    （本次新增 / 本轮对话 / 刚才 / 上文提到——未来读者无法解析）
#    「本次提交」是执行时指代，提交时谁读就指谁的提交，不算泄漏，不查。
#    历史叙述只属于 changelog / ADR / sunset / _archived / blue-print（不检查）
# ---------------------------------------------------------------------------
LEAK=$(grep -rn '本次新增\|本轮\|刚才\|上文提到\|上次提到\|本次调整\|本次引入' \
       AGENTS.md collar.yaml README.md README.en.md skills/ docs/specs/README.md \
       docs/architecture/README.md docs/runbook/*.md docs/changelog/README.md \
       2>/dev/null || true)
if [ -z "$LEAK" ]; then
  pass "S7 现状文档无会话指代词"
else
  fail "S7 现状文档出现会话指代（未来读者无法解析）" "改为指代具体文件/章节：$LEAK"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "全部通过 ✓"
  echo "Next: 按 docs/runbook/commit-checklist.md 完成 ③–⑦（changelog / runbook / spec 差异 / 缝补）后提交"
  exit 0
else
  echo "存在失败项，提交被拦截 ✗"
  echo "Next: 按上方逐条修复后重跑 sh scripts/collar-check.sh"
  exit 1
fi

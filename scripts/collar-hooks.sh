#!/usr/bin/env sh
# collar-hooks.sh — 装配 git hooks：core.hooksPath 指向 scripts/hooks/
#
# 为什么用 core.hooksPath 而不是拷贝进 .git/hooks：
#   hook 内容留在仓库里版本化，升级随 pull 生效，全团队共享同一份；
#   代价是每个 clone 要跑一次本脚本（冷启第 5 步）。
#
# 用法（在仓库根执行，需先 git init）：
#   sh scripts/collar-hooks.sh           # 安装
#   sh scripts/collar-hooks.sh --check   # 校验装配状态
#   sh scripts/collar-hooks.sh --remove  # 恢复默认 .git/hooks
#
# 退出码：0 = 完成；1 = 错误

set -u
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT" || exit 1

die() { printf 'ERR  %s\n' "$1" >&2; exit 1; }

git rev-parse --git-dir >/dev/null 2>&1 || die "需在 git 仓库内执行（先 git init）"

case "${1:-install}" in
  install|--install)
    chmod +x scripts/hooks/* 2>/dev/null || die "scripts/hooks/ 不存在或为空"
    git config core.hooksPath scripts/hooks
    echo "installed  core.hooksPath = scripts/hooks"
    echo "  pre-commit  → collar-check + 质量门禁（collar.yaml kind:quality）"
    echo "  commit-msg  → 首行格式「<类型>(<范围>): <说明>」（WIP 豁免）"
    echo "  post-commit → 知识沉淀 ③④ 提醒"
    echo "  pre-push    → 结构门禁复跑 + ⑤⑥⑦ 协议项自查"
    echo
    echo "Next: 做一次提交验证钩子生效（应看到 collar-check 输出）"
    ;;
  --check)
    HP=$(git config core.hooksPath || true)
    if [ "$HP" = "scripts/hooks" ]; then
      echo "ok   core.hooksPath = scripts/hooks"
      ls scripts/hooks | while IFS= read -r H; do
        [ -x "scripts/hooks/$H" ] && echo "ok   $H 可执行" || echo "warn $H 缺执行位（跑 sh scripts/collar-hooks.sh 修复）"
      done
    else
      die "core.hooksPath 未装配（当前：${HP:-未设置}）——跑 sh scripts/collar-hooks.sh"
    fi
    ;;
  --remove)
    git config --unset core.hooksPath 2>/dev/null || true
    echo "removed  core.hooksPath 已恢复默认 .git/hooks"
    ;;
  *)
    die "未知参数：$1（可选 无 / --check / --remove）"
    ;;
esac
exit 0

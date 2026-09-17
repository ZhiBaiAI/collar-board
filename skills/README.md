# collar-* Skills

> **与 AI 工具无关。** 这些 Skill 是**项目资产**，不属于任何 AI 产品。
> 目录放在项目根 `skills/` 是刻意选择：不藏在 `.xxx/` 点目录里、不依赖特定工具的约定，
> **clone 仓库即可用**。换工具时改的是软链或配置，不是 Skill 内容本身。

> 六个 Skill 对应知识库六模块，统一 `collar-` 前缀。
> **模块 ↔ Skill ↔ README 三位一体**：有目录就得有 Skill，有 Skill 就得有 README 说明边界。
> 破了这个结构，知识库就会开始烂。

---

## 速查

| Skill | 管哪个模块 | 回答什么 | 触发方式 | 自动化程度 |
|---|---|---|---|---|
| [collar-specs](collar-specs/SKILL.md) | `docs/specs/` | 要做什么（意图源） | 主动写 + **commit 被动校验** | 半自动（只报不改） |
| [collar-changelog](collar-changelog/SKILL.md) | `docs/changelog/` | 做了什么 | **commit 强制触发** | 全自动 |
| [collar-architecture](collar-architecture/SKILL.md) | `docs/architecture/` | 现在怎样运转 + 为什么这么设计 | 被动（结构性变动自动触发）+ 主动（技术选型） | 自动提取 + 人审决策 |
| [collar-runbook](collar-runbook/SKILL.md) | `docs/runbook/` | 学到了什么 | **commit 强制触发** + 主动 | 全自动 + 人确认 |
| [collar-vendor](collar-vendor/SKILL.md) | `docs/vendor/` | 外部代码怎么用 | 主动 | 人主导 |
| [collar-wiki](collar-wiki/SKILL.md) | `docs/wiki/` | 还没定型的想法 | 主动 | 人主导 |

触发方式**刻意分主动/被动、自动化程度呈梯度** ——
越接近「事实记录」越自动，越接近「判断决策」越人工。

---

## 提交关卡上的协作

一次 git commit，三个 Skill 同时从三个正交维度喂养知识库：

```
git commit
  ├─ collar-changelog → 记「做了什么」
  ├─ collar-runbook   → 抽「学到了什么」
  └─ collar-specs     → 检「代码是否偏离意图」（只报不改）
```

另有 `collar-runbook` 兼任 **AGENTS.md 行数守卫**（>115 行强制迁出）。
详见 [commit-gate.md](../docs/runbook/commit-gate.md)。

---

## 新增 Skill 的规则

1. 必须对应一个 `docs/` 下的模块目录（不允许凭空加 Skill）
2. 命名 `collar-⟨模块名⟩`，frontmatter 的 `name` 必须与目录名一致
3. `description` 必须写清**触发词**（用户会说什么话时才用它）—— 不写触发词的 Skill 等于不存在
4. 同步更新本文件速查表与该模块的 README
5. 在 SKILL.md 末尾写明「与其他 Skill 的协作」，避免职责打架

**结构约定（六个 SKILL.md 统一）**：
- frontmatter：`name` / `description`（含触发词）/ `agent_created` / 有参数时加 `argument-hint`
- `## 护栏`：硬否定句集中一节（永远不许做的事），散落在叙述文里的禁令提炼到这里，可扫读
- `Next:` 行：主流程末尾给下一步衔接（脚本命令 / 交接给哪个 Skill）
- 有被动触发输出的 Skill（如 specs 模式B）写**输出契约**：记分卡 + CRITICAL/WARNING/SUGGESTION 分级，每条附 `文件:行` 与可操作建议，拿不准往轻了报

---

## 各工具如何加载

| 工具类型 | 接入方式 |
|---|---|
| 支持项目级 Skill 目录的（如 Claude Code `.claude/skills/`） | 软链：`ln -s ../skills .claude/skills` |
| 只支持规则文件的（如 Cursor `.cursor/rules/`） | 规则里写一行：「按根目录 `AGENTS.md` 与 `skills/` 下的规范执行」 |
| 通用兜底 | 会话开始时让 Agent 先读 `AGENTS.md`，它会按图索骥找到本目录 |

**原则：Skill 内容只写一份，放在 `skills/`。**
不要为了适配工具把内容复制进各工具的目录 —— 那会产生多份真相，改一处漏一处。

# docs/runbook/ — 过程知识

**回答：这个项目有哪些「踩过坑才知道」的知识。**

这类知识不写在任何代码里，但对 AI 价值最高 —— 它决定了 AI 会不会重蹈覆辙。
由 `collar-runbook` Skill 在 **git commit 时自动抽取**，也可随时主动记录。

---

## 内容分区

| 文件 | 装什么 |
|---|---|
| [conventions.md](conventions.md) | **强约定** —— 全项目必须遵守，违反即拦截 |
| [environments.md](environments.md) | **环境差异** —— 预发/线上/本地的隐藏地形 |
| [troubleshooting.md](troubleshooting.md) | **排障剧本** —— 现象 → 根因 → 解法 |
| [testing.md](testing.md) | **测试知识总入口** —— 分层口径 / 运行时机 / 冒烟清单 / 测试坑 |
| [context-stitching.md](context-stitching.md) | **上下文缝补协议** —— AI 时代最重要的工程纪律 |
| [anchor-registry.md](anchor-registry.md) | **锚点登记册** —— 凡「逻辑离开代码」必须登记一条 |
| [commit-gate.md](commit-gate.md) | **提交关卡** —— 一次提交触发三个 Skill |
| [commit-checklist.md](commit-checklist.md) | **提交检查清单** —— 逐项勾选，结果附进 commit message |
| [_template-stitching-skill.md](_template-stitching-skill.md) | **MCP 配套 Skill 模板** —— 何时查/怎么查/查到后用 |

不属于以上各类的零散经验，直接以条目形式追加到本文件的「通用过程知识」。

> **测试知识的两个落点别混**：**单个功能点**的测试点写在
> `docs/specs/NN_[域]/NN_功能/tests.md`（spec 的伴生文档，`collar-specs` 维护）；
> **跨功能点**的分层口径、运行时机、冒烟清单才在 [testing.md](testing.md)。
> 功能点测试文档不设中心索引——存在性与 AC 对齐由结构门禁 `collar-check` 校验。

---

## 条目格式（四段式，缺一不可）

```markdown
## ⟨一句话结论⟩

- **现象**：⟨看到了什么⟩
- **根因**：⟨为什么会这样⟩
- **结论**：⟨以后该怎么做 / 该避开什么⟩
- **证据**：⟨提交哈希 / 日期 / 相关文档链接⟩
```

**没有「结论」的条目不许入库** —— 只记录现象不提炼规则，等于制造噪音。

---

## 本 Skill 的三条硬职责

1. **沉淀** —— commit 后自动抽取约定与坑
2. **守卫 AGENTS.md** —— >115 行立即把细节迁到 docs/，入口只留「摘要 + 链接」
3. **维护关键约定速查表** —— AGENTS.md 里那张「约定 / 一句话 / 详见」三列表

新增约定进速查表的门槛（防止表膨胀）：
- 违反过至少一次，或可预见会反复踩
- 能用一句话说清
- 有明确的正例 / 反例

超过 12 条时按主题折叠，AGENTS.md 只留分组标题 + 链接。

---

## 通用过程知识

<!-- 追加条目时保持格式统一：现象 / 根因 / 结论 / 证据 -->

（暂无）

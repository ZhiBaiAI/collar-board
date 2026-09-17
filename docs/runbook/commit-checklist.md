# 提交检查清单

> **Agent 每次 git commit 前必须打开本文件逐项勾选。**
> 这是「Agent 侧硬指令」执行体的落地物 —— 本模板不预置 hooks 脚本，
> 强制力来自：**每次会话必读的 AGENTS.md 硬指令 + 本清单的逐项留痕 + 月度审计**。

---

## 使用方式

勾选完成后，把结果以注释形式附在 commit message 末尾（或 PR 描述里）：

```
<类型>(<范围>): <一句话说明>

commit-checklist: 1✅ 2✅ 3✅ 4✅ 5✅ 6✅ 7✅
偏离说明: <无 / 见 docs/changelog/…>
```

留痕的目的不是形式主义 —— **能被人看到的检查，才会真的发生**。

---

## 清单

### ① 结构门禁（collar-check，技术拦截）

- [ ] `sh scripts/collar-check.sh` 全绿（骨架完整 / 行数 / tests.md 伴生 / AC 对齐 / ADR 编号 / 双向指针 / changelog 联动 / 会话指代）
- [ ] 没有把调试代码、`⟨.env⟩`、锁文件改动混进本次提交

### ② 质量门禁（工程侧，落地后启用）

- [ ] `⟨make lint⟩` 通过
- [ ] `⟨make typecheck⟩` 通过
- [ ] `⟨make test⟩` 通过

### ③ collar-changelog —— 记「做了什么」

- [ ] 已判断变更类型（`feature` / `patch` / `sunset` / `refactor` / `fix` / `chore`）
- [ ] 已写入 `docs/changelog/YYYY/YYYY-MM.md`
- [ ] 作者、影响面、关联 spec 坐标已填
- [ ] 如有 **BREAKING** 变更，已加粗置顶并写明迁移方式

### ④ collar-runbook —— 抽「学到了什么」

- [ ] 本次是否踩了新坑 / 立了新约定 → 是则已落 `conventions.md` / `troubleshooting.md`
- [ ] 新约定已同步进 AGENTS.md 关键约定速查表（一句话 + 链接）
- [ ] 每条都有「结论」，不是纯现象流水账

### ⑤ collar-specs —— 检「代码是否偏离意图」

- [ ] 已反查本次改动文件对应的 spec 坐标
- [ ] 已输出差异清单（语义冲突 / 代码超集 / Spec 超集 / 未认领）
- [ ] **没有自动反向修改 Spec**（偏离与否由人决策）
- [ ] 若为「编码中发现了更好的方案」，已建 patch 并建双向指针
- [ ] **测试覆盖无漂移**：改动的功能点，其 `tests.md` 与 spec §5 的 `AC-N` 编号一一对得上；
      新增 AC 已有测试点，或已登记进 `tests.md` §3「已知缺口」
- [ ] patch 改了验收标准，已同步 `tests.md` 并在其「变更记录」留痕
- [ ] 本次改动覆盖的实施任务（feature §8 `T-N` / patch §⑦ `T-PNNN-N`）已勾选；
      任务未勾完不把状态标「已验证」

### ⑥ 入口地图守卫

- [ ] `AGENTS.md` ≤ 120 行且未逼近 115 守卫线；逼近则已把细节迁到 `docs/` 并只留摘要 + 链接
- [ ] 现状类文档（`AGENTS.md`、各 `README.md`、架构视图）只写现在时事实——
      没有引入历史变迁词或会话指代（如「以前 / 不再 / 新增了检查项」这类写法，
      检查规则见 `scripts/collar-check.sh` S7 注释；历史叙述只进 changelog / ADR / sunset / `_archived/`）

### ⑦ 上下文缝补检查

- [ ] 本次是否把逻辑外置出代码（提示词 / 配置 / 脚本 / 规则）？
  - 否 → 勾选通过
  - 是 → 已按 [context-stitching.md](context-stitching.md) 缝补（MCP 通道 / `//!` 锚点 / 环境声明），
    并登记进 [anchor-registry.md](anchor-registry.md)
- [ ] 未缝补的项已在 ADR「后果」中登记为技术债（写明责任人与计划日期）

---

## 绕过声明（仅在允许场景使用）

| 项 | 内容 |
|---|---|
| 绕过原因 | ⟨WIP 提交 / 纯 typo 修正 / 其他（写明）⟩ |
| 影响范围 | ⟨…⟩ |
| 补做时间 | ⟨YYYY-MM-DD⟩ |

> **月度回顾会列出所有被绕过的提交。**
> 反复绕过说明关卡设计有问题 —— **该改的是关卡，不是人**。

---

## 想升级为「技术强制」时看这里

结构门禁（collar-check）已经是技术拦截。语义检查仍是 Agent 侧软执行（靠指令 + 留痕 + 审计）。
若团队规模上来、需要把质量门禁也真正拦住，按 [commit-gate.md](commit-gate.md)「装配方式」一节挂 hooks：
`pre-commit` 放 ①②，`post-commit` 放 ③④，`pre-push` 放 ⑤⑥⑦。
**关卡的执行体可以换，但契约声明只在 `collar.yaml` 一处。**

# 提交关卡：git commit = 统一触发点

> **一次提交，三个 Skill 在同一时刻各司其职、从三个正交维度同时喂养知识库。**

---

## 为什么是 commit

单个 Skill 好做，难的是让多个 Skill 不打架、还能配合。
把 **git commit 这个动作设计成统一触发关卡**，就同时解决了两件事：

1. **时机统一** —— 不需要人记得「什么时候该更新文档」
2. **强制落地** —— 知识沉淀从「靠自觉」变成「流程门禁」，
   杜绝「这次先算了、下次一定」的滑坡
   （一旦开始欠账，知识库很快就会烂掉）

---

## 三个维度（正交，不重叠）

| Skill | 记什么 | 输出到 | 人的介入 |
|---|---|---|---|
| `collar-changelog` | **做了什么** | `docs/changelog/YYYY/YYYY-MM.md` | 无（全自动） |
| `collar-runbook` | **学到了什么** | `docs/runbook/*`（约定 / 环境 / 排障） | 确认抽取是否准确 |
| `collar-specs` | **代码是否偏离了意图** | 差异清单（**只报不改**） | **必须决策** |

---

## 关卡顺序

```
git commit
   │
   ├─ ① 结构门禁（collar-check）   —— 知识库形状：行数/AC 对齐/指针/指代词
   │      失败 → 直接拦截（复制模板即生效）
   │
   ├─ ② 质量门禁（工程侧）        —— lint / typecheck / test（落地时装配）
   │      失败 → 直接拦截
   │
   ├─ ③ changelog 沉淀            —— 全自动，无需人介入
   │
   ├─ ④ runbook 抽取              —— 抽约定与坑，人确认后入库
   │
   ├─ ⑤ spec 差异检测             —— 输出差异清单，交人决策
   │      · 语义冲突 → 必须处理
   │      · 代码超集 / Spec 超集 → 提醒
   │
   └─ ⑥ 上下文缝补检查            —— 外置了逻辑而未缝补
```

---

## 差异清单输出格式（`collar-specs` 模式 B）

```markdown
### Git 提交触发：Spec-Code 差异检测（需求澄清）

- [语义冲突] ⟨文件⟩：Spec 说 ⟨A⟩，代码实际 ⟨B⟩
- [代码超集] ⟨文件⟩：新增了 ⟨C⟩，Spec 未覆盖
- [Spec 超集] ⟨文件⟩：Spec 要求 ⟨D⟩，代码未实现
- [未认领]   ⟨文件⟩：落在未认领区域

→ 请人工确认：更新 Spec / 回退代码 / 记录为有意偏离（附理由）
```

**注意：不自动反向更新 Spec。**

> Spec 是意图源，比代码更早期。代码偏离 Spec 不一定是错误 ——
> 可能是编码过程中发现了更好的方案。所以把决策权交给人，
> 把「文档变化」从**静默忽略**变成**显式决策**。

---

## 强制力从哪来

门禁分两类，强制力来源不同：

**结构门禁 = 技术拦截（开箱即用）。**
`scripts/collar-check.sh` 只依赖 POSIX sh / grep / find / wc，语言无关，
复制模板即真实生效：AGENTS.md 行数、tests.md 伴生与 AC 对齐、ADR 编号唯一、
patch 双向指针、changelog 联动、会话指代词。它不依赖任何人「记得」或「自觉」。

**质量门禁 + 语义检查 = 协议执行（按技术栈装配）。**
本模板**不预置语言相关的质量门禁脚本**（lint/typecheck/test 保持语言无关占位，
见 `collar.yaml` 的 `quality` 类）。语义级检查（spec 差异、知识沉淀、缝补检查）
由 Agent 按协议执行。这部分由三条机制共同构成 —— **缺任何一条都会退化成靠自觉**：

| 机制 | 作用 | 落点 |
|---|---|---|
| **硬指令** | 每次会话必加载，写明「缺一项不得提交」 | `AGENTS.md` 第 7 节 |
| **逐项留痕** | 勾选结果附进 commit message，**能被人看到的检查才会真的发生** | [commit-checklist.md](commit-checklist.md) |
| **月度审计** | 被绕过的提交集中列出，反推关卡设计问题 | changelog 月度回顾 |

**诚实的局限**：语义检查是「强约束的行为协议」，不是技术拦截。
它能挡住「忘了做」，挡不住「铁了心绕过」——所以结构可查的都交给 collar-check。

升级为技术强制的信号（命中任一就该挂 hooks）：
- 月度回顾中绕过提交占比 > ⟨20%⟩
- 出现「知识库与实际代码明显脱节」
- 有非研发角色参与（工程素养不足以支撑软约束）

**再往上一级台阶：哨兵机**（独立机器还原预发合并态 + Agent 隐形冲突检测）。
hooks 挡的是单仓提交质量；哨兵机挡的是**多人分支各自全绿、合并后才现形的冲突**。
命中任一就该启动：
- 多仓并行开发，预发同时存在 ⟨3+⟩ 个集成分支
- 节奏进入「每周一个大版本」量级
- 出现过「各自分支全绿、合到预发后炸」的隐形冲突
→ 设计与待决问题见 [[讨论稿]哨兵机](../wiki/blue-print/[讨论稿]哨兵机.md)。

---

## 装配方式

结构门禁（collar-check）无需装配，复制即生效。**git hooks 随模板自带**，clone / 冷启后跑一次：

```bash
sh scripts/collar-hooks.sh        # 装：core.hooksPath 指向 scripts/hooks/
sh scripts/collar-hooks.sh --check   # 验：装配状态与执行位
sh scripts/collar-hooks.sh --remove  # 卸：恢复默认 .git/hooks
```

用 `core.hooksPath` 而不是拷贝进 `.git/hooks`：hook 内容留在仓库里版本化、
全团队共享同一份；代价是每个 clone 跑一次安装脚本。

| 钩子 | 放什么 | 脚本行为 |
|---|---|---|
| `scripts/hooks/pre-commit` | ① 结构门禁（collar-check）+ ② 质量门禁 | 跑 collar-check 后，逐条执行 collar.yaml `kind: quality` 的 `cmd`——仍是 ⟨占位符⟩ 的自动跳过 |
| `scripts/hooks/commit-msg` | 规范 commit message（便于 changelog 提取） | 首行须为「<类型>(<范围>): <说明>」，WIP 豁免；缺 checklist 留痕打印 hint 不拦截 |
| `scripts/hooks/post-commit` | ③④ 知识沉淀 | 提交触及 specs/src/scripts 时提醒补 changelog/runbook（不阻塞） |
| `scripts/hooks/pre-push` | ⑤⑥ 差异检测 + 缝补检查 | 结构门禁复跑 + ⑤⑥⑦ 协议项自查清单 |

其他装配方式（职责不变，钩子里的逻辑照旧）：

| 方式 | 适用 | 挂接点 |
|---|---|---|
| 包管理器钩子 | Node（husky）/ Python（pre-commit 框架） | 调用同四个脚本即可 |
| CI 流水线 | 团队项目 | PR 检查阶段跑 `sh scripts/collar-check.sh`（**注意**：此时已错过本地沉淀时机，建议本地 + CI 双挂） |

---

## 绕过规则

- **允许绕过**：`WIP` 提交、纯文档 typo 修正（用 `--no-verify` 显式声明）
- **不允许绕过**：涉及接口签名、数据字段、共享配置的改动
- **审计**：被绕过的提交应在月度回顾中列出，反复绕过说明关卡设计有问题（该改的是关卡，不是人）

---

## 与 collar.yaml 的关系

`collar.yaml` 的 `validation.gates` 声明了哪些门禁是必须的（`structure` / `quality` 两类）、
`on_gate_failure: block | warn` 决定失败时拦截还是告警。
**关卡的执行体可以在任何地方，但契约声明只在 collar.yaml 一处。**
结构门禁的执行体随模板自带（`scripts/collar-check.sh`），质量门禁的执行体落地时装配。

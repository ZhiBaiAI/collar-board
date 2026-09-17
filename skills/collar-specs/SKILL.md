---
name: collar-specs
description: 管理 docs/specs 站点地图（意图源）。两种模式——写 Spec（按 feature/patch/sunset/blueprint 四种变更类型落盘，强制 patch 双向指针）、校验 Spec（提交时做代码 ↔ Spec 差异检测，只输出差异清单交人决策，禁止自动反向改 Spec）。当用户说「写个 spec」「这个需求怎么做」「加个功能」「改一下 XX」「XX 下线」「提交前检查一下」时使用。
agent_created: true
argument-hint: ⟨feature|patch|sunset⟩ ⟨功能名⟩
---

# collar-specs — Spec 站点地图管理员

## 核心哲学（先记住这两条，它们决定了所有行为）

1. **Spec 是意图源，比代码更早期。**
   代码偏离 Spec **不一定是错误**——可能是编码过程中发现了更好的方案。
2. **因此提交时不自动反向更新 Spec。**
   只输出「差异清单」，把决策权交给人。把「文档变化」从静默忽略变成显式决策。

## 触发方式

| 类型 | 时机 | 行为 |
|---|---|---|
| 主动 | 用户描述新需求 / 说「写个 spec」「这个怎么做」「XX 下线」 | 进入**模式 A：写 Spec** |
| 被动 | git commit（提交关卡，强制） | 进入**模式 B：校验 Spec** |
| 被动 | 用户改完代码说「提交」「commit」 | 同模式 B |

---

## 模式 A：写 Spec

### Step 0 — 需求澄清（先问清楚再落盘）

- **先查证再提问**：读相关 spec / 代码 / tests / ADR 后再问，不让用户复述机器可查的事实；查不到或证据矛盾时说明限制再问。
- **一次一个聚焦问题**，说明它解锁哪个决策（选型 / 范围 / 验收）；只在用户要求时才批量问。
- **给有依据的建议**：证据足够时给出推荐项 + 理由 + 备选代价，而不是只罗列选项。
- **分层记录**：区分「已确认 / 建议默认 / 未决」——**沉默不等于接受**，写不准的进 §1.2 待确认表。
- **适可而止**：够判型和落盘就停；用户可随时叫停、转向或搁置，不追问整棵决策树。

### Step 1 — 判定变更类型（这决定了文件放哪）

| 场景 | 类型 | 落盘位置 |
|---|---|---|
| 新功能；或稳定功能的正式迭代 | **feature** | `docs/specs/NN_[业务地图]域/NN_功能名/spec.md` |
| 小改动；或多人要并行改同一个 feature | **patch** | `docs/specs/…/PATCH-NNN-简述.md` |
| 旧功能下线 / 迁移 | **sunset** | `docs/specs/…/SUNSET-NNN-简述.md` |
| 前期预研、还没定型 | **blueprint** | `docs/wiki/blue-print/`（**不在 specs 里**） |
| 无 commit 权参与者 / AI 大改动 | **proposal** | `docs/specs/…/PROPOSAL-NNN-简述.md`（审阅通过后由本 Skill 转为 feature/patch 落库） |

判断口诀：**定型了才进 specs，没定型一律去 wiki 的 blue-print 里养。**

### Step 2 — 定位站点地图坐标

1. 打开 `docs/specs/README.md` 看业务地图划分与认领表。
2. 归属到已有业务域；**没有合适域就新建 `NN_[业务地图]XX域/`**，并同步更新站点地图与认领表。
3. 数字前缀保证有序，不要重排已有编号（重排 = 制造冲突）。

### Step 3 — 复制模板并填写

优先走脚本（自动编号 + 落对位置）：
`sh scripts/collar-new.sh <feature|patch|sunset> <域或功能目录> <名称>`；手工时复制对应模板：

- feature → `docs/specs/_templates/feature.md`
- patch → `docs/specs/_templates/patch.md`
- sunset → `docs/specs/_templates/sunset.md`
- blueprint → `docs/wiki/blue-print/_template-blueprint.md`
- proposal → `docs/specs/_templates/proposal.md`（审阅通过 → 转对应变更类型并登记，驳回 → 保留理由）

写作规则统一以 `collar.yaml` 的 `authoring.rules` 为准（每类产物一节，不再各模板抄一遍）。
feature §8 / patch §⑦ 的**实施任务**按 `T-N` / `T-PNNN-N` 编号，提交时按覆盖勾选。

> 新建 feature 前，先过模板 §1.1 的**准入四问**（问题-方案匹配 / 范围受控 / 复用优先 / 验收可逆）；
> 写不准的事实填进 §1.2 待确认表并标注，**禁止用猜测填充**（见 conventions C-004）。

### Step 3.5 — 建立伴生测试文档 `tests.md`（feature 必做）

`tests.md` 是 spec 的**伴生文档，不是第五种变更类型**（类型永远是 feature/patch/sunset/blueprint 四种）。
它回答「这个功能点的每条验收标准靠什么测出来」，**新建 feature 时必须与 spec 一起建立**：

1. **验收标准先编号**：spec §5 每条写成 `AC-1`、`AC-2`…（patch §⑥ 用 `AC-P⟨NNN⟩-N`）。
   编号是与 tests.md 的连接键，**已用编号不要复用**。
2. **复制 `_templates/tests.md`** 到功能点目录，逐条 AC 填测试点（层级 / 测什么 / 对应 AC / 代码位置 / 状态）。
3. **不需要登记任何中心索引** —— tests.md 与 spec.md 同目录即可被发现，
   结构门禁 `collar-check`（`scripts/collar-check.sh`）会逐功能点校验存在性与 AC 对齐。
4. **没有测试点的 AC 不许留空** —— 写进 `tests.md` §3「已知缺口」（原因 + 责任人），
   而不是假装覆盖了。

> **为什么这一步是硬性**：验收标准不编号、测试点不回指，两者就各自演化，
> 「产品以为已实现、测试以为覆盖完整」的偏差无法被机械检出（见本仓库 docs/specs/README.md）。
> 分层口径（unit/integration/e2e/manual）见 [runbook/testing.md](../../docs/runbook/testing.md) §2，**不要自创层级名**。

### Step 4 — patch 必须建双向指针（硬性）

单向指针会造成语义二义性：只在 patch 说「我改了 X」，读主文档的人不知道；
只在主文档划掉 X，读 patch 的人不知来龙去脉。**两个方向都要建**：

- **Patch → 主文档**：patch 开头声明覆盖范围（目标文件 + 章节 + 原状态）。
- **主文档 → Patch**：在被替代的章节处标注「本段已被 PATCH-NNN 取代 + 链接 + 生效日期」。

并且：**Patch 自身必须可独立阅读**，不依赖读者先读主文档。
这对 AI 尤其友好——从任何文件切入都能拼出「当前生效的真相」，不被过期描述误导。

**patch §⑥ 验收标准必须写成 Delta 四段**（硬性，可被机器合并的原因）：
`### ADDED`（新验收标准，`AC-P⟨NNN⟩-N` 编号）/ `### MODIFIED`（替代主文档某条 `AC-N`，编号必须存在）/ `### REMOVED`（作废 `AC-N` + 原因）/ `### RENAMED`（`- FROM: `AC-旧号`` 紧跟 `- TO: `AC-新号``，改编号不改正文）。
没有对应类型的小节整节删除，不留空标题。**同一个 `AC-N` 不许出现在两个小节里**。
结构门禁 S5 校验：引用编号存在性 / TO 必须是新号 / FROM-TO 成对 / 跨小节冲突 / 段外孤儿行 / 小节标题拼错。

**Patch 的收敛**（满足条件时执行）：
- 并存期**以 patch 为准**——主文档被取代章节仅作历史
- 时机：合并后稳定 ⟨14⟩ 天无回滚，或同一 feature 下 patch 累积 ≥ ⟨3⟩ 个（`collar-status.sh` 会列出超期项）
- 动作：`sh scripts/collar-converge.sh <PATCH-文件>` 机械合并 Delta 并标「已收敛」→ 按脚本列出的剩余手工项收尾（正文合入主章节并移除取代标记 / tests.md 清理 / 变更历史补记 / changelog 记一条）
- **收敛不是删除 patch 文件**

**Patch 改了验收标准 → 必须同步 `tests.md`（硬性）**：
回到同目录 `tests.md` 追加/更新对应测试点、在其「变更记录」留一行
（MODIFIED 的主文档 AC 回指编号不变，核对判定文本是否需要更新）。否则 patch 生效了测试还停在旧版本——
这正是 patch 存在的意义（并行不打架）被反转成「并行后对不齐」。

### Step 5 — sunset 是状态机，不是删除

**禁止 `git rm` 掉旧 spec。** 直接删 = 历史上下文永久丢失，未来排查灰度期线上问题会抓瞎。
sunset 产出的是一份**带状态机的可执行迁移剧本**：评估 → 预告 → 双写/灰度 → 切流 → 观察 → 归档。

### Step 6 — 引用 vendor 作为实证参考源

写技术方案前，扫描 `docs/vendor/` 里是否有相关参考实现：
提取代码模板、API 用法、架构模式，融入方案并**标注来源**。

> 「用户放进 vendor 的代码不一定完整阅读过，这一步帮用户『读』并提炼要点。」

### Step 7 — 自检清单（不通过不许落盘）

- [ ] 变更类型判定正确，文件放对了位置
- [ ] 坐标已登记进站点地图与认领表
- [ ] 验收标准**已编号 `AC-N`**且可测试（能量化，不是「体验良好」）
- [ ] 已建同目录 `tests.md`，每条 AC 至少对应一个测试点；无测试点的 AC 已登记为缺口
- [ ] 影响面写清：动了哪些模块 / 接口 / 数据 / 配置
- [ ] patch 已建双向指针，且可独立阅读
- [ ] patch §⑥ 是 Delta 四段；MODIFIED/REMOVED/RENAMED(FROM) 的 `AC-N` 在主文档存在；无空标题小节；同一 AC 不跨小节
- [ ] patch 改动的验收标准已同步进 `tests.md`
- [ ] feature §8 / patch §⑦ 实施任务已编号，已完成项已勾选
- [ ] sunset 有状态机与回滚口径
- [ ] 引用了 vendor 的，已标注来源

Next: `sh scripts/collar-status.sh` 看全局在途变更；git commit 时本 Skill 自动转入模式B。

---

## 模式 B：校验 Spec（提交时）

### 执行步骤

1. 取本次提交涉及的变更文件列表。
2. 反查每个文件在 `docs/specs/` 的归属坐标（查站点地图认领表）。
3. 分类判定：

| 差异类型 | 含义 | 处理 |
|---|---|---|
| 代码超集 | 代码做了 Spec 没写的事 | 提醒补 spec 或说明是临时代码 |
| Spec 超集 | Spec 写了但代码没做 | 提醒排期或降级 Spec |
| 语义冲突 | 两边描述的是同一件事但结论不同 | **重点报警**，交人决策 |
| 无对应 Spec | 改动落在未认领区域 | 提醒认领或归入 blueprint |
| **测试覆盖漂移** | §5 有 `AC-N` 但 `tests.md` 无对应测试点；或 `tests.md` 引用了不存在的 `AC-N`；或代码改了测试点却没同步 | 提醒补齐测试点或登记缺口（不自动改） |

> **测试覆盖漂移是机械可查项**：验收标准与测试点之间靠 `AC-N` 编号对齐，
> 因此「哪条 AC 没测」是可算出来的，不靠人回忆；结构门禁 `collar-check`（S3）逐功能点校验。

4. **输出差异报告，不改任何文件。** 输出契约（固定格式，不许自由发挥）：

```markdown
### Git 提交触发：Spec-Code 差异检测

| 维度 | 结果 |
|---|---|
| 语义冲突 | ⟨N⟩ 处 |
| 代码超集 | ⟨N⟩ 处 |
| Spec 超集 | ⟨N⟩ 处 |
| 无对应 Spec | ⟨N⟩ 处 |
| 测试覆盖漂移 | ⟨N⟩ 处 |

**[CRITICAL] 提交前必须人决策**
- ⟨文件:行⟩：Spec 说 ⟨A⟩，代码实际 ⟨B⟩ → 建议：更新 Spec / 回退代码 / 记为有意偏离（附理由）

**[WARNING] 应处理**
- ⟨文件:行⟩：⟨差异⟩ → 建议：⟨补 spec / 排期 / 补测试点⟩

**[SUGGESTION] 可选**
- ⟨文件:行⟩：⟨差异⟩ → 建议：⟨…⟩
```

分级规则与启发式（硬约束）：

| 严重度 | 差异类型 |
|---|---|
| **CRITICAL** | 语义冲突（同一件事两边结论不同） |
| **WARNING** | 代码超集、Spec 超集、测试覆盖漂移、落在新逻辑的「无对应 Spec」 |
| **SUGGESTION** | 落在杂项改动的「无对应 Spec」、风格性偏差 |

- 每条**必须附 `文件:行` 与一条可操作建议**，不写「建议检查一下」这种空话
- **拿不准往轻了报**：不确定是不是冲突就报 WARNING，不编 CRITICAL
- 全部干净也要**显式输出「全部通过」**，不许静默跳过

5. 若用户确认「这是更好的方案」→ 走模式 A 建立 patch 或更新 feature，并建双向指针。

Next: 差异结论进 changelog 或 spec 备注区；确认「更好方案」→ 回模式A 建 patch；确认「有意偏离」→ 附理由记一条 changelog。

---

## 护栏

- ❌ 模式B 只报不改：不自动反向改 Spec、不自动改 tests.md
- ❌ 因为「赶时间」跳过差异检测，或把差异结论只写在对话里不落盘（落 `docs/changelog/` 或对应 spec 备注区）
- ❌ patch 没有双向指针不落盘；patch §⑥ 必须是 Delta 四段，引用编号必须在主文档存在、同一 AC 不跨小节、RENAMED 的 FROM/TO 成对
- ❌ 复用或重排已用过的 `AC-N` / `T-N` 编号
- ❌ `git rm` sunset 对象——下线走状态机，文件留作历史
- ❌ 用猜测填充写不准的事实（进待确认表并标注）
- ❌ 自创变更类型（永远 feature/patch/sunset/blueprint 四种）或测试层级名

---

## 与其他 Skill 的协作

- `collar-changelog`：差异清单的结论同步进时间线
- `collar-runbook`：反复出现的偏离类型沉淀成强约定
- `collar-vendor`：写技术方案时的实证参考源
- `collar-wiki`：blueprint 成熟后由本 Skill 接收「毕业」，迁入 specs 成为 feature

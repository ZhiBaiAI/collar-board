# docs/specs/ — 站点地图（正式规格层）

借鉴 Web2.0 的**站点地图（sitemap）**思路：一个网站上线前，先画出有哪些分区、
每个分区有哪些页面，然后不同人认领不同页面并行开发。
**在动工之前，就把整个系统的疆域横向铺开、切分清楚。**

> 一个业务地图 = 站点的一个分区；一个功能模块 = 分区里的一个页面/功能区。

---

## 目录约定

```
docs/specs/
├── README.md                       # 本文件：站点地图 + 规则
├── _templates/                     # 模板（feature / patch / sunset / proposal / tests）
├── _archived/                      # 日落归档区（只进不改，禁止删除）
└── NN_[业务地图]XX域/               # ← 真实业务域按模块建域（看板解析视图、项目管理视图等）
```

**数字前缀保证目录天然有序，不要重排已有编号**（重排 = 制造冲突）。

---

## 四种变更类型：覆盖所有需求演进行为

| 类型 | 什么时候用 | 落盘位置 | 模板 |
|---|---|---|---|
| **feature** | 新功能；或稳定功能的正式迭代 | `NN_[域]/NN_功能/spec.md` | [_templates/feature.md](_templates/feature.md) |
| **patch** | 小改动；或多人要**并行**改同一个 feature | 同目录下 `PATCH-NNN-简述.md` | [_templates/patch.md](_templates/patch.md) |
| **sunset** | 旧功能下线 / 迁移 | 同目录下 `SUNSET-NNN-简述.md` | [_templates/sunset.md](_templates/sunset.md) |
| **blueprint** | 前期预研、还没定型 | **`../wiki/blue-print/`**（不在这里） | [wiki/blue-print/_template-blueprint.md](../wiki/blue-print/_template-blueprint.md) |

> **feature / patch / sunset 活在 specs（正式规格层），blueprint 刻意活在 wiki（自由探索层）。**

**配套脚本**（`scripts/`，复制即生效）：`collar-new.sh` 从模板自动编号建变更、
`collar-status.sh` 列出在途事项与超期 patch、`collar-converge.sh` 执行 patch 机械收敛、
`collar-init.sh` 冷启清理示范内容、`collar-hooks.sh` 装配 git hooks（`scripts/hooks/`）、
`collar-sync.sh` 从上游 collar-sdd 同步机械资产（模板升级）。
脚本输出末尾的 `Next:` 行告诉下一步做什么。

### 为什么这样切分能让人天然分开

1. **目录即认领单元** —— A 认领「创建项目」、B 认领「项目循环」，
   各自的 spec 目录**物理隔离**，冲突可能性降到最低。
2. **patch 让并行不打架** —— 小改动走补丁，多人可在同一 feature 下并行提交，
   主 spec 只在稳定后收敛。
3. **生命周期明确** —— 大前期设计走蓝图，功能下线走日落，稳定功能走 feature + patch。

一个完整生命周期：`blueprint(预研)` → `feature(正式)` → `patch(迭代)` → `sunset(日落归档)`。

### 伴生文档 `tests.md`：不是第五种变更类型

每个功能点目录下可以有且只有一份 `tests.md`，它是 `spec.md` 的**伴生文档**：

- **它不参与上面的类型划分** —— 变更类型永远只有 feature / patch / sunset / blueprint 四种。
  `tests.md` 是「依附于某个功能点的测试知识」，不表达需求演进，**不要给它编号**（不叫 `TEST-001`）。
- **它靠验收标准编号与 spec 连接** —— spec §5 的每条验收标准编号为 `AC-N`
  （patch §⑥ 用 `AC-P⟨NNN⟩-N`），`tests.md` 的每个测试点必须回指某条 AC。
  于是「验收标准可测试」从口号变成**可机械核对**的事实：有 AC 却无测试点即视为缺口。
- **它随功能点的生命周期走** —— 新建 feature 时一并建立；patch 改了验收标准就同步追加测试点；
  功能 sunset 时测试点标作废但**记录保留**（与 sunset「不删除、移归档」的哲学一致）。

模板：[_templates/tests.md](_templates/tests.md)。
跨功能点的测试知识（分层口径 / 运行时机 / 冒烟清单）**不放这里**，见 [runbook/testing.md](../runbook/testing.md)。

---

## 提案通道（Proposal）：无 commit 权限的参与者怎么改东西

**为什么所有角色都围绕代码上下文协同**：代码是距离用户真实体验最近的
「最后一份可版本化、可追踪、可验证的共同事实」。产品文档、设计稿、测试用例
都是它的投影。让所有角色的判断持续回到代码上校准，才能尽早发现
「产品以为已实现、测试以为覆盖完整」与真实系统之间的偏差。

但**不能假设不懂 git 的人会记得「不要 push 到主干」**——
参与者的工程素养越低，约束就必须越硬。所以：

- **dev 角色**（研发）：按上文规则直接提交。
- **non-dev 角色**（测试/产品/设计，及 AI 的大改动）：**一切代码改动走提案**，
  不直接落库。提案 = 已验收净 diff + 需求 + 决策 + 验收证据，
  经 dev 审阅后 cherry-pick 净改动应用（转为 feature/patch 并登记）。

模板：[_templates/proposal.md](_templates/proposal.md)。
角色边界声明：[collar.yaml](../../collar.yaml) `boundary.roles`。

> 提案机制对 AI 同样有价值：**大改动先沉淀为提案再审阅**，
> 是「文档变化从静默忽略变成显式决策」在落库环节的延伸。

---

## 认领表（进入开发前必须填）

**相关同学进入开发前，一开始就要确认清楚**：负责的产品模块、负责的 spec 范围。
**任何边界之外的协同都要和项目组对焦。**

> **本表只登记「一次写入、低频变化」的责任信息**（业务域 / 模块 / 负责人 / spec 路径）。
> 前台路由、后台 API 等接口事实写在各 spec 的接口契约节——这里是唯一落点，
> 手抄第二份必然腐化（结构门禁不查路由，但查没人认领的功能点）。

| 业务域 | 模块 | 负责人 | Spec 路径 |
|---|---|---|---|

---

## 关键规格一：patch 双向指针

**问题**：当一个 patch 要替代主方案里的某段内容时——
只在 patch 里说「我改了 X」，读主文档的人不知道；
只在主文档划掉 X，读 patch 的人不知来龙去脉。这是**语义二义性**。

**强制双向建立指针**：

主文档侧（被替代处）：

```markdown
> ⚠️ 本段已被 [PATCH-001](./PATCH-001-xxx.md) 取代（生效日期 2026-09-09）。
> 以下内容仅作历史上下文保留，不代表当前生效实现。
```

Patch 侧（开头声明覆盖范围）：

```markdown
## 覆盖范围（Supersedes）
- 目标文件：[spec.md](./spec.md) › 章节「⟨章节名⟩」
- 原状态：⟨一句话描述被替代的旧方案⟩
- 新状态：⟨一句话描述新方案⟩
- 生效日期：⟨YYYY-MM-DD⟩
```

**Patch 自身必须可独立阅读**，不依赖读者先读主文档。
这对 AI 尤其友好——从任何文件切入都能拼出「当前生效的真相」，不被过期描述误导。

### patch §⑥：验收标准用 Delta 四段（可被机器合并的原因）

patch 对主文档 §5 验收标准的改动必须写成四类小节，而不是自由描述：

- **`### ADDED`** —— 新增的验收标准，用 patch 自带编号 `AC-P⟨NNN⟩-N`
- **`### MODIFIED`** —— 替代主文档某条 `AC-N` 的新文本（该编号必须在主文档存在）
- **`### REMOVED`** —— 作废主文档某条 `AC-N`，附原因
- **`### RENAMED`** —— 只改编号不改正文：`- FROM: `AC-旧号`` 紧跟 `- TO: `AC-PNNN-N`` 成对写（TO 必须用 patch 编号体系）

没有对应类型的小节整节删除、不留空标题；**同一个 `AC-N` 不许出现在两个小节里**——
结构门禁 S5 校验引用存在性、TO 新号、FROM-TO 配对、跨小节冲突、段外孤儿行与小节标题拼错。

四类小节就是 patch → 主文档的机械映射：收敛时 `collar-converge.sh` 据此合文，
不靠人抄；结构门禁 S5 据此校验编号，不靠人盯。

### patch 的收敛（并存是过渡，不是常态）

patch 的存在意义是**让并行不打架**，收敛时机与动作：

| 项 | 规则 |
|---|---|
| **并存期以 patch 为准** | 主文档被取代章节仅作历史，**当前生效真相 = patch**（取代标记就是为此而设） |
| **收敛时机** | patch 合并后稳定 ⟨14⟩ 天无回滚；或同一 feature 下 patch 累积 ≥ ⟨3⟩ 个 |
| **收敛动作** | ① `sh scripts/collar-converge.sh <PATCH-文件>` 机械合并 §⑥ Delta（MODIFIED 换文 / REMOVED 作废留墓碑 / RENAMED 换编号 / ADDED 追加）并标 patch「已收敛」② 人/Agent 完成脚本列出的剩余项：正文合入主章节并移除取代标记、tests.md 清理、变更历史补记、changelog 记一条 |

收敛由 feature 负责人触发、`collar-converge.sh` + `collar-specs` 执行。**收敛不是删除 patch 文件。**

---

## 关键规格二：sunset 是状态机，不是删除

**禁止 `git rm` 掉旧 spec。** 直接删 = 历史上下文永久丢失，
未来排查灰度期的线上问题会抓瞎。

sunset 产出的是一份**带状态机的可执行迁移剧本**：
`评估 → 预告 → 双写/灰度 → 切流 → 观察 → 归档`，
每一步都有进入条件、回滚口径、验证方式。

### 归档 = 移动到 `_archived/`，不是删除

最后一个阶段「归档」的落地动作是：把 spec 移入 [`_archived/`](_archived/README.md)，
并登记进归档清单。**代码可以删（git 历史可回），spec 不能删** ——
它是意图记录，删了就永久丢失历史上下文。

---

## 代码 ↔ Spec 的反向提醒

代码写着写着可能偏离 spec。`collar-specs` 在提交时做检查，但**不自动反向更新 Spec**：

> **Spec 是意图源，比代码更早期。代码偏离 Spec 不一定是错误——
> 可能是编码过程中发现了更好的方案。**

所以提交时只输出**差异清单**，把决策权交给人。
配合工程侧的 lint 门禁与 `collar-changelog` 强制约束，
构成「**Agent 语义检查 + git hook 质量检查**」的双保险。

---

## 新建 feature 的检查清单

- [ ] 已确认归属业务域，或已新建域并更新本文件的认领表
- [ ] 已登记负责人与 spec 路径（路由与接口写进 spec 的接口契约节，不在认领表重抄）
- [ ] 使用 [_templates/feature.md](_templates/feature.md)，验收标准**已编号 `AC-N`**且可测试
- [ ] 已建同目录 [tests.md](_templates/tests.md)，每条 `AC-N` 至少对应一个测试点
- [ ] 影响面写清：动了哪些模块 / 接口 / 数据 / 配置
- [ ] 如需预研，先在 wiki/blue-print 里养，别直接写 specs

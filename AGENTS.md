# AGENTS.md — Agent 入口地图

> 本文件是 Agent 的入口地图（≤120 行）。**不放细节，只告诉你去哪里找。**
> 行数由 `collar-runbook` Skill 守卫：逼近 115 行时，把详情迁到 `docs/`，此处只留一行摘要 + 链接。

## 0. 铁律（动手前必读）

1. **只看本文件不够。** 按需打开下文的链接，禁止凭猜测改代码。
2. **看不到的知识等于不存在。** 任何结论必须落到仓库文件里，不留在会话里。
3. **Spec 是意图源，比代码更早期。** 代码偏离 Spec 不一定是错——可能编码时发现了更好的方案。提交时**只输出差异清单交人决策，禁止自动反向改 Spec**。
4. **任何导致上下文异常的架构变动都必须缝补。** 见 [上下文缝补协议](docs/runbook/context-stitching.md)。
5. **提交前必过门禁。** 见 [提交关卡](docs/runbook/commit-gate.md)。

## 1. 项目是什么

- **做什么**：Collar 工程看板——只读解析遵循 Collar SDD 规范的项目，把知识库文档渲染成六个可视化视图（总览/业务地图/在途变更/决策脉络/变更时间线/结构事实）
- **服务谁**：用 Collar SDD 管理项目的团队；本仓库自身也是 collar-sdd 的下游项目（模板升级走 `collar-sync.sh`）
- **当前阶段**：v1 可用，随上游规范演进持续跟进
- **北极星指标**：任给一个 collar 规范项目目录，一眼看出「知识哪里缺、哪里不一致」

## 2. 仓库地图

```
collar-board/
├── collar.yaml          # AI 项圈：Identity / Boundary / Validation 三层声明
├── AGENTS.md            # 本文件：入口地图
├── VERSION              # 基于的 collar-sdd 模板版本（collar-sync.sh 维护）
├── index.html           # 页面入口（无构建，浏览器直接跑 ESM）
├── server.mjs           # 零依赖静态服务（本地开发用，npm start → :5173）
├── src/
│   ├── parse/           # 解析层：纯函数，「文件路径→文本」进、模型出，不碰 DOM/FS
│   ├── fs/              # 文件读取层：浏览器目录句柄 → 文本 Map（只读）
│   └── ui/              # 界面层：装配 + 六个视图 + 样式
├── scripts/             # collar 门禁/操作脚本（上游资产，别改）+ export-fixture.mjs（项目自有）
├── skills/              # 六个 collar-* Skill（上游资产）
├── docs/                # 知识库六模块（详见第 5 节）
└── test/                # node:test 测试（真实仓数据断言 + 单元用例）
```

## 3. 快速命令

| 动作 | 命令 | 说明 |
|---|---|---|
| 本地启动 | `npm start` | 零依赖静态服务，端口 :5173，须 Chromium 内核浏览器 |
| 测试 | `npm test` | node:test；解析正确性用同级 `../collar-sdd` 仓做真实输入（缺失自动跳过） |
| 结构门禁 | `sh scripts/collar-check.sh` | 知识库结构检查，提交前必过 |
| 变更操作 | `collar-new.sh` / `collar-status.sh` / `collar-converge.sh` / `collar-sync.sh`（均在 scripts/） | 建变更 / 在途导航 / patch 收敛 / 模板升级 |
| 装配关卡 | `sh scripts/collar-hooks.sh` | clone 后跑一次：git hooks（pre-commit 等 4 个）生效 |

## 4. 关键约定速查表

| 约定 | 一句话 | 详见 |
|---|---|---|
| 只读约束 | 看板全程只读被查看项目，不调用任何写入接口 | README.md「授权说明」 |
| 解析层纯净 | `src/parse/` 只依赖输入文本，禁碰 DOM/文件系统——Node 可直接测 | README.md「项目结构」 |
| 零依赖 | 不加 npm 依赖、不加构建步骤——`node server.mjs` 能跑是唯一要求 | package.json |
| 不编造 | 规范没有的数据不呈现：不评分、不算进度、不报「看不到的文件不存在」 | README.md「为什么做这个」 |
| 浏览器限制 | 目录读取只在 Chromium（安全上下文 localhost/https）有效 | README.md「快速开始」 |
| 环境差异 | 无预发/线上环境，纯本地静态应用；怪异现象先怀疑浏览器权限回收 | [environments.md](docs/runbook/environments.md) |
| 事实缺口 | 缺事实就显式标记「待确认」并发起提问，禁止用猜测填充继续推进 | [conventions.md](docs/runbook/conventions.md) |
| 验收与测试 | spec §5 编号 `AC-N`，同目录 `tests.md` 测试点逐条回指；跨功能点知识去 testing.md | [testing.md](docs/runbook/testing.md) |
| 文档时态 | 现状文档只写现在时；历史叙述只进 changelog / ADR / sunset / 归档区 | [conventions.md](docs/runbook/conventions.md) |

完整表见 [关键约定](docs/runbook/conventions.md)。

## 5. 知识库六模块（去哪找答案）

| 我要找… | 去这里 | 谁维护 | 对应 Skill |
|---|---|---|---|
| 功能该怎么做（意图源） | [docs/specs/](docs/specs/README.md) | 人写 + AI 校验 | `collar-specs` |
| 什么时候改了什么 | [docs/changelog/](docs/changelog/README.md) | AI 自动 | `collar-changelog` |
| 系统现在怎样运转 + 为什么这么设计 | [docs/architecture/](docs/architecture/README.md) | AI 自动 + 人审 | `collar-architecture` |
| 踩过什么坑、有什么约定 | [docs/runbook/](docs/runbook/README.md) | AI 自动 | `collar-runbook` |
| 外部参考代码怎么用 | [docs/vendor/](docs/vendor/README.md) | 人放 + AI 提炼 | `collar-vendor` |
| 还没定型的想法 | [docs/wiki/](docs/wiki/README.md) | 人写 | `collar-wiki` |

## 6. 需求变更走哪条路（四种类型 + 提案通道）

| 场景 | 类型 | 落盘位置 | 模板 |
|---|---|---|---|
| 新功能 / 稳定功能迭代 | feature | `docs/specs/` | [feature.md](docs/specs/_templates/feature.md) |
| 小改动 / 多人并行改同一 feature | patch | `docs/specs/…/PATCH-xxx.md` | [patch.md](docs/specs/_templates/patch.md) |
| 旧功能下线 | sunset | `docs/specs/…/SUNSET-xxx.md` | [sunset.md](docs/specs/_templates/sunset.md) |
| 前期预研、未定型 | blueprint | `docs/wiki/blue-print/` | [blueprint.md](docs/wiki/blue-print/_template-blueprint.md) |
| **无 commit 权参与者 / AI 大改动** | proposal | `docs/specs/…/PROPOSAL-xxx.md`，审阅后落库 | [proposal.md](docs/specs/_templates/proposal.md) |

规则与成熟度阶梯见 [specs 站点地图](docs/specs/README.md)。

## 7. 提交关卡（git commit = 统一触发点）— **强制执行**

**Agent 每次 git commit 前必须依次完成下列 7 步，缺一项不得提交：**

1. 打开 [commit-checklist.md](docs/runbook/commit-checklist.md) 逐项勾选
2. `sh scripts/collar-check.sh` → 结构门禁全绿（技术拦截，缺一项直接失败）
3. `collar-changelog` → 记**做了什么**（时间线）
4. `collar-runbook` → 抽**学到了什么**（过程知识）
5. `collar-specs` → 检**代码是否偏离意图**（**只报不改**，交人决策）
6. 确认本文件 ≤ 115 行（超出先迁出详情再提交）
7. 确认本次没有「外置逻辑却未缝补」

**禁止**：以「改动很小 / 赶时间」为由跳过；用 `--no-verify` **静默**绕过。
**允许绕过**：仅 `WIP` 与纯 typo 修正，且必须在 commit message 写明原因，月度回顾会列出。

> 知识沉淀是**流程门禁**，不是自觉。一旦开始欠账，知识库很快就会烂掉。

详见 [commit-gate.md](docs/runbook/commit-gate.md)。

## 8. AI 的行为边界

由 [collar.yaml](collar.yaml) 声明：Identity 管知道什么、Boundary 管能改什么、Validation 管改得对不对。**Boundary 默认拒绝（deny-by-default）**。

Skill 清单见 [skills/](skills/README.md)（项目自带，与具体 AI 工具无关）。

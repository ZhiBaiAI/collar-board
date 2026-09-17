# docs/ — 知识库六模块

> **对 Agent 来说，看不到的知识等于不存在。**
> 所以项目知识一律版本化落到这里，而不是留在会话里、脑子里、或者聊天记录里。

## 三位一体

每个模块都是 **模块 ↔ Skill ↔ README** 三位一体：
有目录就得有 Skill（规定什么时候写、怎么写），有 Skill 就得有 README（规定边界）。
破了这个结构，知识库就会开始烂。

| # | 模块 | 回答的问题 | 维护方式 | Skill |
|---|---|---|---|---|
| ① | [specs/](specs/README.md) | **要做什么**（意图源） | 人写 + AI 校验 | `collar-specs` |
| ② | [changelog/](changelog/README.md) | **做了什么**（时间线） | AI 自动（commit 触发） | `collar-changelog` |
| ③ | [architecture/](architecture/README.md) | **现在怎样运转 + 为什么这么设计** | AI 自动 + 人审 | `collar-architecture` |
| ④ | [runbook/](runbook/README.md) | **学到了什么**（过程知识） | AI 自动（commit 触发） | `collar-runbook` |
| ⑤ | [vendor/](vendor/README.md) | **外部代码怎么用** | 人放 + AI 提炼 | `collar-vendor` |
| ⑥ | [wiki/](wiki/README.md) | **还没定型的想法** | 人写 | `collar-wiki` |

## 六个模块 = 三个方向的「两面」

| 方向 | 面向未来（意图） | 面向过去（事实） |
|---|---|---|
| 做什么 | specs（要做什么） | changelog（做了什么） |
| 怎么做 | architecture（现在怎样 + 为什么这么设计） | runbook（踩过什么坑） |
| 从哪来 | wiki（外部世界与想法） | vendor（外部代码资产） |

## 自动化梯度

六个 Skill 的触发方式**刻意分了主动与被动**，自动化程度呈梯度：

```
全自动（被动触发，人不介入）
  └─ changelog    ← commit 强制触发
  └─ runbook      ← commit 强制触发
半自动（AI 自动提取，人来决策）
  └─ specs        ← commit 触发差异检测，只报不改
  └─ architecture ← 结构性变动自动触发，ADR 由人审拍板
人工主导（主动触发）
  └─ vendor       ← 放入外部代码
  └─ wiki         ← 调研与构思
```

## 统一触发关卡：git commit

一次提交，三个 Skill 在同一时刻各司其职、从三个正交维度同时喂养知识库：

- `collar-changelog` 记**做了什么**
- `collar-runbook` 抽**学到了什么**
- `collar-specs` 检**代码是否偏离了意图**

详见 [runbook/commit-gate.md](runbook/commit-gate.md)。
**强制是真强制**——知识沉淀从「靠自觉」变成「流程门禁」。

# Vendor 登记册

> **唯一事实来源。未登记的代码文件视为垃圾，可被清理。**

---

## 登记格式

```markdown
## ⟨名称⟩ ⟨版本⟩

- **来源**：⟨URL / commit⟩ ｜ **许可**：⟨License⟩ ｜ **同步方式**：⟨快照 / 补丁⟩
- **为什么需要**：⟨解决我们的哪个问题⟩
- **保留范围**：⟨只留了哪些文件，删掉了什么⟩
- **提炼要点**：⟨3-5 条可直接复用的模式 / API 用法 / 坑⟩
- **适用**：⟨哪些 spec 会用到它⟩
- **登记日期**：⟨YYYY-MM-DD⟩
```

---

## 条目

## collar-sdd v1.0.0（上游规范模板）

- **来源**：https://github.com/ZhiBaiAI/collar-sdd ｜ **许可**：MIT ｜ **同步方式**：`sh scripts/collar-sync.sh`（机械资产覆盖：scripts/ skills/ _templates/ VERSION）
- **为什么需要**：本仓库的知识库骨架、门禁、技能全部来自该模板；看板解析的对象文件格式也由它定义——上游格式演进（如 Delta 四段）必须同步跟进
- **保留范围**：AGENTS.md / collar.yaml / docs/ 骨架（项目内容已填） / scripts/ / skills/ / VERSION
- **提炼要点**：① patch §⑥ 用 Delta 四段（ADDED/MODIFIED/REMOVED/RENAMED），RENAMED TO 必须 AC-PNNN-N；② 变更文件类型 feature/patch/sunset/proposal；③ 状态枚举含 已验证/已收敛/已废弃；④ feature §8 与 patch §⑦ 有 T-N/T-PNNN-N 实施任务
- **适用**：`src/parse/specs.js`、`src/parse/ac.js`、`src/parse/findings.js` 的解析口径
- **登记日期**：2026-09-17

## OpenSpec v1.x（参考规范，非代码快照）

- **来源**：https://github.com/Fission-AI/OpenSpec ｜ **许可**：MIT ｜ **同步方式**：参考（不落代码，只登记可借鉴机制）
- **为什么需要**：变更生命周期的机械化参照——本项目 patch 的 Delta 三段、收敛脚本、`Next:` 导航均借鉴其 `changes/` + delta + archive + status 设计
- **保留范围**：不复制代码；借鉴的机制已内化为 `_templates/patch.md` §⑥、`scripts/collar-converge.sh`、`collar.yaml authoring`
- **提炼要点**：① 在途变更与正式规格分层（changes/ ↔ specs/）；② 验收标准改动写成 ADDED/MODIFIED/REMOVED 使合并可机械执行；③ 命令输出末尾给下一步导航；④ 写作规则集中声明（config.yaml rules）
- **适用**：`docs/specs/` patch/收敛流程、`scripts/` 操作脚本
- **登记日期**：2026-09-17

---

## 清理记录

| 日期 | 条目 | 原因 | 操作人 |
|---|---|---|---|

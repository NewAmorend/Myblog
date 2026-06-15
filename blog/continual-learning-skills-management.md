---
title: Skills 的产出与管理
date: 2026-05-12
tag: Continual-Learning
---

> Trace + Feedback 的输入进来之后，期望的产出是 Skills。这里有两个核心问题：**什么时候产出**、**怎么管理已有 Skills**。

## 两个核心问题

```
Trace + Feedback（输入）
        ↓
    产出 Skills（输出）
        ↓
  ┌─────────────────┐
  │ 1. 什么时候产出？  │
  │ 2. 怎么管理？      │
  └─────────────────┘
```

### 问题一：产出

- 什么时候该产出一个 Skill？
- 怎么产出合理的、好的 Skill？
- 不是所有经验都应该变成 Skill，筛选标准是什么？

### 问题二：管理

- 已有的 Skill 怎么维护？
- 过时的 Skill 怎么淘汰？
- Skill 之间的冲突怎么处理？

## SkillOS 的经验：Skill Curator

SkillOS 的解法是引入一个 **Skill Curator**（技能策展人）来统一管理产出和管理。

```
        Trace + Feedback
              ↓
        Skill Curator
        ┌─────┴─────┐
        ↓           ↓
    产出新 Skill   管理已有 Skill
    （何时创建）    （更新/淘汰/合并）
```

### Skill Curator 的角色

- **产出端：** 判断什么时候该从经验中提炼出一个新 Skill
- **管理端：** 维护 Skill 库的健康度，处理过时、冲突、冗余
- **质量端：** 确保产出的 Skill 是合理的、可复用的、不是过拟合的

### 训练 Curator

Google 用的方案：
- **Gemini 2.5 Pro** — 大模型做 Curator
- **Qwen 32B** — 轻量模型做 Curator

Curator 本身是训练出来的，用标注好的 Skill 管理数据做 SFT/RL。

## 开放问题：训练数据的覆盖面

### 核心疑问

> 训练数据是否能涵盖多数 Skill 场景？

Skill 的种类极多：
- 代码相关（调试、重构、部署...）
- 内容创作（写作、翻译、排版...）
- 数据处理（清洗、分析、可视化...）
- 系统运维（监控、告警、扩容...）
- 用户交互（问答、推荐、陪伴...）

**问题：** 标注数据很难覆盖所有场景。总有没见过的 Skill 类型。

### 如果当下无法涵盖，Infra 如何补足？

这是关键问题。可能的方向：

**1. Few-shot 泛化**
- Curator 在少量已知 Skill 类型上训练
- 靠模型的泛化能力处理未见过的类型
- 风险：泛化质量不可控

**2. 分层 Curator**
- 一个通用 Curator 处理常见类型
- 多个垂直 Curator 处理特定领域
- 未覆盖的类型 fallback 到通用 Curator

**3. 人机协作**
- Curator 初步判断 → 人工审核 → 人工标注 → 回流训练
- 类似 RLHF 的闭环，但粒度在 Skill 级别

**4. Skill Template + 参数化**
- 不训练所有 Skill 类型
- 训练一个 Skill 的「骨架模板」
- 新场景只需填参数，不需要从零学

**5. 元学习（Meta-Learning）**
- Curator 学的不是「怎么管理某个具体 Skill」
- 而是「怎么快速适应一个新的 Skill 类型」
- MAML 等元学习框架的思路

## 一个隐含的递归问题

Skill Curator 本身也是一个 Skill。
那谁来管理 Curator？

```
Skill → 需要 Curator 管理
Curator → 也是一个 Skill → 需要 Curator 管理？
```

这可能是一个无限递归，也可能是一个自举（bootstrap）问题——Curator 管理所有 Skill 包括自己。

---

*创建日期: 2026-05-12*
*来源: 与用户的讨论*

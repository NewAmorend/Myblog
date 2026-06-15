---
title: Continual Learning for AI Agents
date: 2026-05-12
tag: Continual-Learning
---

> AI Agent 的持续学习：如何让智能体在部署后不断进化，而不是停留在训练时的知识水平。

## 核心框架

从三个层面理解持续学习：

| 层面 | 改变什么 | 成本 | 频率 |
|------|----------|------|------|
| **Model** | 模型权重（SFT/RL） | 极高 | 低 |
| **Harness** | 工具/编排/中间件 | 中 | 中 |
| **Content** | Prompt/Memory/Instructions | 低 | 高 |

详见 → [Continual Learning - Three Levels](article.html?post=continual-learning-three-levels)

## 核心公式

```
Trace（发生了什么）+ Feedback（好不好）= RL 的燃料
```

详见 → [Continual Learning - Trace and Feedback](article.html?post=continual-learning-trace-feedback)

## 产出与管理

```
Trace + Feedback → Skills → Skill Curator（产出 + 管理）
```

详见 → [Continual Learning - Skills Production and Management](article.html?post=continual-learning-skills-management)

## 子主题

- [Continual Learning - Three Levels](article.html?post=continual-learning-three-levels) — 三个层面总览（Model / Harness / Content）
- [Continual Learning - Trace and Feedback](article.html?post=continual-learning-trace-feedback) — Trace + Feedback：持续学习的燃料
- [Continual Learning - Skills Production and Management](article.html?post=continual-learning-skills-management) — Skills 的产出与管理（Skill Curator）
- Continual Learning - Memory Systems — 记忆系统设计
- Continual Learning - Learning from Feedback — 从反馈中学习
- Continual Learning - Knowledge Update — 知识更新机制
- Continual Learning - Open Questions — 待解决的问题

## 关键词

`continual learning` `lifelong learning` `online learning` `experience replay` `memory augmentation` `tool learning` `self-improvement` `meta-harness` `trace` `feedback` `LLM-as-Judger` `attribution` `skill curator` `skillOS` `meta-learning`

---

*创建日期: 2026-05-12*

---
title: Continual Learning for AI Agents - 三个层面
date: 2026-05-12
tag: Continual-Learning
---

> 持续学习不是单一维度的事。要从 Model、Harness、Content 三个层面来看，模型可以在每个层面实现自进化。

## 1. Model 层：权重级学习

最底层、最彻底的学习方式。直接更新模型权重。

**方法：**
- SFT（Supervised Fine-Tuning）
- RL（Reinforcement Learning）/ RLHF / DPO

**问题：**
- **成本巨大** — 需要大量算力和数据
- **周期太长** — 不是实时能做的事
- **灾难性遗忘（Catastrophic Forgetting）** — 微调新能力时，旧能力可能退化

**定位：** 最根本的进化方式，但不适合高频迭代。

## 2. Harness 层：设施级学习

Harness 是模型配套的设施，包括：
- 工具（tools）
- 循环调用（agent loop）
- 中间件设计（middleware）

### Meta-Harness

Meta-Harness 揭示了 Harness 是如何迭代的：

```
Harness 在一系列任务上运行
        ↓
    产生轨迹（traces）
        ↓
    暴露给 Eval Agent
        ↓
    评估 + 优化 Harness
```

**核心启示：trace 对于 Harness 的优化来说，价值极高。**

Harness 不改模型权重，而是通过优化工具编排、中间件逻辑、循环策略来提升 Agent 表现。

## 3. Content 层：上下文级学习

包括：
- System Prompt
- Instructions
- Memory System

**关键区别：** 这一层学习的不是「agent 记住了什么」，而是「学会了怎么用和什么时候用」。

- 不是存储事实，而是习得策略
- 不是记忆内容，而是理解用法
- 从交互中提炼出何时调用哪个工具、以什么方式组织输出

## 三个层面的关系

| 层面 | 改变什么 | 成本 | 频率 | 彻底程度 |
|------|----------|------|------|----------|
| Model | 模型权重 | 极高 | 低 | 最彻底 |
| Harness | 工具/编排/中间件 | 中 | 中 | 中等 |
| Content | Prompt/Memory/Instructions | 低 | 高 | 最轻量 |

越往上越轻量、越灵活、越适合高频迭代。越往下越彻底、越根本、但成本越高。

---

## 开放问题：Trace 采集的统一难题

### 问题描述

Harness 层的持续学习高度依赖优质 trace。但目前不同 harness 的设计差异很大：

- **Codex** 和 **Claude Code** 对同一个概念可能有不同的命名
- 有的叫 `thread`，有的叫 `session`
- 数据结构、字段名、粒度都不统一

### 核心挑战

> 如何跨 harness 统一地采集和标准化 trace，是 Harness 层持续学习的第一难题。

没有统一的 trace 格式，就无法：
1. 跨系统比较 Agent 表现
2. 汇聚多源数据做 Harness 优化
3. 建立通用的 Eval Agent 评估框架

### 可能的方向

- 定义一个 trace schema 标准（类似 OpenTelemetry 的 tracing spec）
- 中间层适配器：不同 harness → 统一格式
- 从语义层面对齐而非结构层面

---

*创建日期: 2026-05-12*
*来源: 与用户的讨论*

---
title: Agent 轨迹的基本介绍
date: 2026-05-22
tag: AI-Agent
---

# Agent Trajectory是什么
Agent Trajectory（Agent 轨迹）是指一个LLM Agent 在完成过程中和环境（Environment) 交互过程中，产生的一系列完整交互历史。主要包括「 动作（Action）、思考（Thought）、观察（Observation）、结果（Outcome）」

它的结构灵感其实来源于马尔可夫决策过程（MDP），MDP主要有4个要素：

 State：状态，在Agent中指的是当前环境的快照，比如工具调用结果，仓库中的代码

 Action Space：动作空间，模型可进行的行为，或可调用的工具。比如思考，调用skill。

Transaction：状态转移，Action后State如何发生变化

Reward：对结果（可以是当前动作，也可以是整条轨迹）的评分

Agent Trajectory主要是LLM的训练、微调的核心数据格式，用于RLHF、STF、Reward Model的训练。

# Agent Trajectory的基本格式

众所周知，目前主要的Agent范式是ReAct，基于这个前提，Agent Trajectory的基本格式如下所示（该格式是经过高度抽象的，实际生产中会更细致）：

```
Thought: 我需要先查找当前天气数据...
Action: search_web("Las Vegas weather today")
Observation: {"temperature": 38, "condition": "sunny", ...}
```

# ATIF
这里介绍一种常用的标准化JSON AI Trajectory 格式，Agent Trajectory Interchange Format（ATIF）。
这里放个学习链接
https://www.harborframework.com/docs/agents/trajectory-format
Pedantic结构如下：

| 模型                     | 功能                              |
| ---------------------- | ------------------------------- |
| `Trajectory`           | 根级别轨迹对象（完整的一次任务运行）              |
| `Agent`                | Agent 配置信息（模型、系统提示等）            |
| `Step`                 | 单个交互步骤                          |
| `ToolCall`             | 工具/函数调用记录                       |
| `Observation`          | 环境反馈结果                          |
| `Metrics`              | Token 用量、cost、logprobs 等 LLM 指标 |
| `FinalMetrics`         | 轨迹级别的汇总指标                       |
| `completion_token_ids` | 专门支持 RL 训练流程                    |

## Trajectory中的工具调用格式
Nvidia的官方文档中，规定了他们的Trajectory的工具调用格式需要包含以下字段

```
{
  "step": 1,
  "name": "web_search",
  "params": {"query": "LangGraph tutorial 2025"}
}
```

相同step为并行调用，反之为顺序。

## Trajectory质量评估指标

对轨迹质量的评价指标主要包括：
**Step Efficiency（步骤效率）**：
$$
 η=optimal stepsactual steps/actual stepsoptimal steps​
$$
，衡量浪费的步骤数量
**Tool Accuracy（工具准确率）**：工具调用是否必要且参数正确
**Recovery Rate（恢复率）**：Agent 遇到错误后的自我纠正能力

编者注：现在又种说法称这种软件工程式的质量评估标准已然失真，编者会在后面章节介绍当下几种主流的Trajectory质量评估指标和方式
## 三、Trajectory 数据的生成与训练应用

## 数据采集方式

|方式|特点|代表项目|
|---|---|---|
|人工标注（Human Annotation）|高质量但成本高昂，不可扩展|WebArena 人工演示|
|自动化合成（Automated Synthesis）|可扩展，成本低|AgentTrek[^8]|
|失败轨迹重利用（HER Relabeling）|将失败 Trajectory 转化为正向训练数据|AgentHER[^9]|
|RL 在线采集（Online Rollout）|通过 Monte Carlo 滚动获取奖励信号|AgentPRM[^10]|

## AgentTrek：利用 Web 教程合成轨迹

**AgentTrek**（ICLR 2025 Spotlight）是一个代表性的 GUI Agent 轨迹合成 Pipeline：

1. 自动从互联网爬取教程文本
    
2. 将教程转化为任务目标 + 分步指令
    
3. 使用 VLM Agent 在真实数字环境中模拟执行
    
4. VLM Evaluator 对生成轨迹进行质量过滤

## AgentHER：失败轨迹的再利用

**AgentHER** 借鉴 HER（Hindsight Experience Replay）思想，通过四阶段 pipeline（失败分类 → outcome 提取 → LLM 引导的 prompt relabeling → 数据打包）将失败轨迹转化为 SFT/DPO/ShareGPT 训练数据。在 WebArena 和 ToolBench 上，AgentHER 相比只用成功轨迹的 SFT baseline 提升 **+7.1–11.7 pp**，数据效率提高 **2×**

## AgentPRM：过程奖励模型

**AgentPRM** 是一类提供逐步决策级反馈的 Process Reward Model，用于解决长时序任务中的信用分配问题。与只在 episode 结束时给出奖励的 Outcome RM 不同，AgentPRM 在每一步的 (st,at)(st​,at​) 对上估计质量分数。训练流程分三阶段：

1. **Rollout & Compute Targets**：执行策略 π，收集轨迹并计算 PRM 目标值
    
2. **Train PRM**：基于 Monte Carlo targets 训练 PRM
    
3. **Train Policy via RL**：用 KL 散度约束最大化 PRM 奖励

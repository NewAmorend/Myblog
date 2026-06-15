---
title: 自进化的基于对抗去噪抗干扰的 DeepResearch Agent
date: 2026-06-09
tag: Research-Agent
---

# 前言
## Research Agent的几个挑战
利用AI Agent进行研究任务时，通常面临以下几点挑战：
1. 跨领域跨类别的文章检索
2. 如何实现Agent的自主性，主动检索相关文件、补足缺失信息、优化报告
3. 长程思考
# 项目整体架构
![播放器截图20260602150831](assets/blog/obsidian/self-evolving-deepresearch-agent-01.jpg)
用户输入Query之后，先生成针对Query的研究简报和提纲，根据提纲打一个报告草稿，随后进入多智能体系统，主要分为主Agent和子Agent，主Agent会调用子Agent对草稿的质量进行评估，发现草稿中的不足或缺陷后再进行调研，查看是否是真的有缺陷，如果有如何进行修改或补充，主Agent则主要负责编排子Agent，给他们派发任务。

# 基于TTD-DR思想的去噪机制
基于谷歌的TTD-DR论文中的红蓝对抗思想，设计了去噪核心：
 红队：Critic Agent，主要负责审查当前草稿中的逻辑漏洞和信息缺失
 蓝队：Supervisor Agent，根据红队和评委的反馈做出决策
 评委：Evaluator Agent 对报告进行打分

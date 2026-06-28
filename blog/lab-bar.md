---
title: 在前沿 lab 的 bar 越来越高的时候，我们还能做什么
date: 2026-06-28
tag: Notes
---

本文为读 [Vlad Feinberg](https://vladfeinberg.com/)博客有感而发。

## 基模组的现状
由于笔者本人也只是一个还在读大二的半吊子选手，因此此处所称“现状”实则只是笔者从几个在基模组工作的朋友口中道听途说总结而来的消息，如有偏差请多海涵。

如今的基模组的门槛对于绝大多数的应届本科生来说，已经高不可攀，甚至对于很大一部分硕博来说也是如此。如果身边有在基模组工作，或是打算应聘相关岗位的朋友，那你多半会听到xxx即使有多少篇A，多少篇三大会，实习履历多么多么丰富，在秋招时也被拒之门外。

如果这些有着更高学历，更丰富履历的硕博们都如此举步维艰，那我们这些还有2年甚至更久才能正式工作的本科生如今还能做什么，或者说如今我们需要做什么，需要学习什么，才能有机会从事AI前沿的核心工作，甚至说进入前沿的AI lab。很有幸今天我读到了一篇文章，解决了我的困惑。

### 为什么进入这些Lab如此困难
在 Vlad Feinberg的博客中给出了答案，想要进入这些实验室，你需要与一群有着很强的校友关系，并且拥有丰富的科研经验的精英大学生竞争。

### 这些人的特征
这些成功的人有着高度重合的特性：
1. 关注高价值领域
2. 坚实的数学基础
3. 坚韧的性格
他们了解哪些问题重要，并且深耕一个领域不断打磨自己的技能以优化这些问题。

## 我们还能做什么
> *Give up your weekends and nights. Burned into my mind is the typical workflow my college friends and I have gone through. We would start from the very morning of Saturday with two big quadruple-shot Panera iced coffees until late, then come back and do it again the following day, hoping to finish early enough to trudge back to our rooms on the other side of campus to get to sleep on time for the start of another week of psets. Rolling deadlines collapse on each other with nothing but another such weekend to look forward to.*

请允许笔者大段引用原作者的表述，他的语言简直理性到残酷，笔者匮乏的语言难以描述这种近乎残忍的努力，如果不倾尽一切地工作，放弃休息的时间，目前还在读的大学生几乎不可能进入到顶尖的实验室中。

这很残忍但是这是事实，就业市场上无数硕博“嗷嗷待哺”，如果一个本科生无法拿出有力的证据，证明他比现有的硕博更有竞争力，那么进入顶尖Lab自然就希望渺茫。并且谁也不知道AI的泡沫什么时候会突然破裂，本科生所谓的培养潜力，对企业来说不过是谎言。

## 具体应该怎么做--关注LLM堆栈的两端
顶尖的AI Lab忙于训练全新的大语言模型，因此产生了一些边缘工作职位的空缺，这里的边缘并不是指工作本身缺乏价值，而是指不需要培训大型语言模型但仍然对业务至关重要的特定领域。

它通常处于LLM堆栈的两端：
下端是Kernel 算子的底层优化，他是神经网路不可或缺的组成部分。
上端是Agentic Loop，无需关注神经网络这个黑盒模型究竟发生了什么，你只在乎他具体可以产生什么有用过的结果。

## AI Infra
由于笔者主要工作来自LLM下方，即Agentic Loops因此此处请参照原文建议：https://vladfeinberg.com/2026/05/10/how-to-land-a-job-at-a-frontier-lab.html

### Agentic Loop
笔者主要关注的领域，因此在传达Vlad Feinberg的观点的同时也会插入一些自己的表达。

Agentic Loop并不是指用用你的Openclaw或者写两段Claude.md。这只是在使用Agent，而不是真正地 work on it。Agentic Loop 要求你关注除LLM本身以外一切能帮助这个随机黑箱模型生成有用回答的可靠构建，比如如何管理Agent的上下文，如何评估那些失败的输出，如何约束Agent的输出以避免回答过于宽泛。用一个时兴的词来做概括，就是如何构建Agent 的 Harness。这通常要求我们关注Agentic Loop的整条链路，从输入到LLM对工具的调用，再到针对LLM中间过程的上下文的处理，再到最后LLM生成的输出，最后还包括对整条链路轨迹的收集与评估。

## Reference
无论想要从事LLM哪端的工作，都应该对其历史及内涵有相应理解，以下链接可以帮助你快速获取相关的论文或博客：
https://vladfeinberg.com/2026/05/10/how-to-land-a-job-at-a-frontier-lab.html

https://arxiv.org/abs/1706.03762

https://arxiv.org/abs/2001.08361

https://arxiv.org/abs/2203.15556

https://arxiv.org/abs/2407.08608

https://yeasy.gitbook.io/agentic_ai_guide

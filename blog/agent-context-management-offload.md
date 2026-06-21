---
title: Agent 中的上下文管理：offload
date: 2026-06-21
tag: AI-Agent
---

## 什么是 offload

"offload" 字面是"把负载转移出去"，核心直觉是：一件昂贵的活儿，不亲自做，转嫁到别处去做/存。

## 一般含义

把工作从"主路径"转移到"副路径"，目的是让主路径保持轻快。两种典型形态：

1. 执行转移：活儿本来在 A 上做，搬到 B 上做。比如主线程不亲自算，丢给线程池；CPU 不亲自渲染，丢给 GPU。
2. 存储转移：东西本来放在"贵的/有限的"存储里，搬到"便宜的/大的"存储里，原处只留指针。比如内存里的数据 swap 到磁盘，context 里的中间结果落盘成文件。

## 为什么重要

因为通常一个模型的上下文窗口就这么大，不能什么东西都往里塞，需要主动管理以避免**上下文腐烂：一种因当前上下文长度接近上下文窗口导致模型能力大幅下降的现象**。只有等到有需要时，再重新读取回来。

## 似乎是个亏本买卖？

熟悉 Infra 的 uu 或许会知道，对模型上下文进行 offload 会破坏 prefix cache 导致 cache hit rate 降低，增加 token 消耗。而且即使不考虑 KV Cache，试着想象一下某次 tool call 返回了 6.66k tokens，然后 offload 把移到磁盘里，下次再用时用 read_file 读回来又增加了 6.66k tokens，还增加了一次工具调用。也就是在单次调用中 offload 怎么算都是一个亏本买卖，那么我们为什么还要使用它。

在解释这一切之前，我们需要了解长程任务的特性--模型 ReAct 自动进行多轮思考和工具调用。换言之，多轮对话才是 Agent 的常见工作场景。现在再重新想象一下，一次编程任务，进行了 30 轮。在第一轮的 bash 调用返回的结果占着上下文窗口，但是对当前的任务的进展大概率已经毫无帮助了，因为它已经转化为了一个模型需要的用完即弃的结果，比如一次报错，日志...。此刻再算一次帐同样 6.66k tokens，如果不 offload，他的 token 消耗就是 6.66k 乘 30 轮，如果进行 offload 即使后续再有几次重新读取（按 5 次算吧）也不过 6.66k 乘 6 轮的 token 消耗。

## 触发机制

现在我们都知道了 offload 的重要性，那么该在何时触发这个机制呢。现在主要有两个时机：

1. tool_result 生成那一刻就 offload，不进 context window，直接换成占位。
2. 做 compaction 的时候再 offload。

对于机制 1 很多 uu 可能会有这样的困惑，不进 context window？那后面再 read_file 回来这个机制的作用在哪？其实在实际的 offload 当中，是会返回一个摘要式的占位符的，如下所示：

```text
[OFFLOADED -> .harness/bash-{timestamp}-{id}.log]
  cmd:          <the shell command that was executed>
  exit:         <exit code - 0 means success, non-zero means failure>
  size:         <original output size in tokens> (<line count> lines)
  duration:     <wall-clock execution time in seconds>
  stdout_tail:  <last few lines of stdout, as a quick sanity signal>
```

其中可以看到 stdout_tail 就是一个摘要。

至于机制 2，就是常规的在上下文长度满足某个阈值比如 message 数量、工具调用数、上下文窗口百分比（这个最常用，一般 fraction 0.7）时进行总结，总结时 offload 掉那些可以被回收的工具调用结果，比如 readfile，这个可以提前规定好白名单进行回收。

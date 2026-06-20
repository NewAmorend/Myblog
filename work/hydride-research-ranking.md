---
title: Hydride Research
date: 2026-06-09
tags: RAG, Hybrid-Search, RRF
---

## 关键字搜索的排序

BM25 给每篇文档算一个**加权词频得分**，分越高说明关键词匹配越好，直接按得分降序取 Top-K。

## 向量搜索的排序

Embedding 模型把 query 和文档都变成向量后，计算**余弦相似度**（或内积），值越接近 1 说明语义越相似，同样按相似度降序取 Top-K。

## Hybrid Search 的排序（RRF）

两路结果合并时不能直接比分数（量纲不同，BM25 分可能是 12.3，余弦相似度是 0.87），所以用 **RRF（Reciprocal Rank Fusion）** 把名次转成统一分数再合并：

$$
\text{RRF Score}(d) = \sum \frac{1}{k + \text{rank}(d)}​
$$

其中 k 通常取 60，rank 是文档在各路结果中的排名。这样无论原始分数量纲如何，最终都能公平合并排序，取 Top-N 返回。

所以简单说：**打分方式不同 → 但排序逻辑（取 Top-K）是一样的**。

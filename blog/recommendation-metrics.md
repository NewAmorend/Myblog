---
title: 推荐系统的指标设计
date: 2026-06-09
tag: Recommendation
---

# Accuracy@N 
只要正确的结果在倒排索引的N个内出现就算对
Accuracy@N  = 在N个内被成功检索的样本/总样本

# MRR@N
检索到的正确结果在N个结果中的平均排名。他的计算主要需要Reciprocal Rank。
比如在N=10时，正确的结果出现在第一个，那么Reciprocal Rank = 1/1， 第10个就是1/10，Reciprocal Rank = 1/N, N为出现的位置
MRR@N = Reciprocal Rank的均值

# nDCG

同时考虑两者，既要正确的结果出现的靠前，也要靠前的结果都和正确结果相关
rel是当前样本和正确结果的是否相关，相关为1，无关为0
![Pasted image 20260609204904](assets/blog/obsidian/recommendation-metrics-01.png)

![Pasted image 20260609204852](assets/blog/obsidian/recommendation-metrics-02.png)


# 总结

![Pasted image 20260609205028](assets/blog/obsidian/recommendation-metrics-03.png)

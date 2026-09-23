import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSeries } from '../api/_lib/series.mjs';

const sample = {
  id: 'agent-systems',
  title: 'Agent 系统设计',
  description: '从基础概念到工程实践。',
  prerequisites: '了解 JavaScript。',
  chapters: ['context-basics', 'memory-design']
};

test('系列保留有序章节和已有翻译', () => {
  const series = normalizeSeries(sample, { translations: { en: { title: 'Agent Systems' } } });
  assert.deepEqual(series.chapters, ['context-basics', 'memory-design']);
  assert.equal(series.translations.en.title, 'Agent Systems');
});

test('系列拒绝非法 ID、重复章节和过长字段', () => {
  assert.throws(() => normalizeSeries({ ...sample, id: '中文 ID' }), /系列 ID/);
  assert.throws(() => normalizeSeries({ ...sample, chapters: ['context-basics', 'context-basics'] }), /重复/);
  assert.throws(() => normalizeSeries({ ...sample, description: '长'.repeat(1001) }), /系列简介过长/);
});

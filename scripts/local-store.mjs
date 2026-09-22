import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

// 仅由本机启动器显式启用；线上 Redis 故障绝不自动切换到本地存储。
export function openLocalStore(path) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  chmodSync(dirname(path), 0o700);
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(`PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS entries (key TEXT PRIMARY KEY, value TEXT NOT NULL, expires INTEGER);
    CREATE TABLE IF NOT EXISTS hashes (key TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(key, field));`);
  const get = (key) => db.prepare('SELECT value FROM entries WHERE key = ? AND (expires IS NULL OR expires > ?)').get(key, Date.now())?.value ?? null;
  const set = (key, value, expires = null) => db.prepare('INSERT OR REPLACE INTO entries VALUES (?, ?, ?)').run(key, String(value), expires);
  function command(args) {
    const [operation, ...values] = args;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM entries WHERE expires IS NOT NULL AND expires <= ?').run(Date.now());
      let result;
      if (operation === 'GET') result = get(values[0]);
      else if (operation === 'SET') {
        set(values[0], values[1], values[2] === 'EX' ? Date.now() + Number(values[3]) * 1000 : null);
        result = 'OK';
      } else if (operation === 'DEL') result = Number(db.prepare('DELETE FROM entries WHERE key = ?').run(values[0]).changes);
      else if (operation === 'HVALS') result = db.prepare('SELECT value FROM hashes WHERE key = ?').all(values[0]).map((row) => row.value);
      else if (operation === 'HSET') {
        result = db.prepare('SELECT 1 FROM hashes WHERE key = ? AND field = ?').get(values[0], values[1]) ? 0 : 1;
        db.prepare('INSERT OR REPLACE INTO hashes VALUES (?, ?, ?)').run(values[0], values[1], values[2]);
      } else if (operation === 'EVAL' && values[0].includes("redis.call('INCR'")) {
        const key = values[2];
        const previous = get(key);
        result = Number(previous || 0) + 1;
        if (previous === null) set(key, result, Date.now() + Number(values[3]) * 1000);
        else db.prepare('UPDATE entries SET value = ? WHERE key = ?').run(String(result), key);
      } else if (operation === 'EVAL' && values[0].includes("redis.call('HGET'")) {
        result = Number(db.prepare('DELETE FROM hashes WHERE key = ? AND field = ? AND value = ?').run(values[2], values[3], values[4]).changes);
      } else throw new Error('本机存储收到不支持的操作');
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { command, close: () => db.close() };
}

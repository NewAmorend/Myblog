import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openLocalStore } from '../scripts/local-store.mjs';

const increment = "local n = redis.call('INCR', KEYS[1]); return n";
const remove = "if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then return 1 end";
test('本机草稿和会话重启后保留，存储文件只允许本人读写',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'blog-local-')); const path=join(dir,'private','store.sqlite');let store;
 try{
  store=openLocalStore(path);
  store.command(['HSET','drafts','one','正文']);store.command(['SET','session','1','EX',100]);store.close();
  store=openLocalStore(path);
  assert.deepEqual(store.command(['HVALS','drafts']),['正文']);
  assert.equal(store.command(['GET','session']),'1');
  assert.equal((await stat(path)).mode & 0o777,0o600);
  store.command(['DEL','session']);assert.equal(store.command(['GET','session']),null);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('登录限速计数不会被重启清空，过期键可重新计数',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'blog-limit-'));const path=join(dir,'store.sqlite');let store;
 try{
  store=openLocalStore(path);
  for(let n=1;n<=10;n++)assert.equal(store.command(['EVAL',increment,1,'limit',900]),n);
  store.close();store=openLocalStore(path);
  assert.equal(store.command(['EVAL',increment,1,'limit',900]),11);
  store.command(['SET','expired','10','EX',-1]);
  assert.equal(store.command(['EVAL',increment,1,'expired',900]),1);
 }finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('删除草稿只删除已读取版本，新版本不会误删',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'blog-draft-'));const store=openLocalStore(join(dir,'store.sqlite'));
 try{
  store.command(['HSET','drafts','one','旧版本']);store.command(['HSET','drafts','one','新版本']);
  assert.equal(store.command(['EVAL',remove,1,'drafts','one','旧版本']),0);
  assert.deepEqual(store.command(['HVALS','drafts']),['新版本']);
  assert.equal(store.command(['EVAL',remove,1,'drafts','one','新版本']),1);
  assert.deepEqual(store.command(['HVALS','drafts']),[]);
 }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

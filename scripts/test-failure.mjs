import fs from 'node:fs';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const before=fs.readFileSync('public/data/news.json','utf8');const jsBefore=fs.readFileSync('public/data/news.js','utf8');
const r=spawnSync(process.execPath,['--input-type=module','-e',"globalThis.fetch=async()=>{throw new Error('simulated network failure')};await import('./scripts/collect.mjs')"],{encoding:'utf8',timeout:10000});
assert.equal(r.status,1);assert.equal(fs.readFileSync('public/data/news.json','utf8'),before);assert.equal(fs.readFileSync('public/data/news.js','utf8'),jsBefore);console.log('전체 수집 실패 시 게시 데이터 보존 확인');

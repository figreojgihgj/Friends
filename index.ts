import yaml from 'js-yaml';
import fs from 'fs';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';
import { newQueue } from '@henrygd/queue';

import * as v from 'valibot';
import { pickOne } from 'foxts/pick-random';

const IndividualLinkSchema = v.object({
  img: v.pipe(v.string(), v.nonEmpty()),
  url: v.pipe(v.string(), v.nonEmpty(), v.url()),
  text: v.pipe(v.string(), v.nonEmpty()),
  alive: v.optional(v.boolean()),
});

const LinksDocumentSchema = v.record(v.string(), IndividualLinkSchema);

const queue = newQueue(16);

// const topUserAgentsPromise = fetch('https://cdn.jsdelivr.net/npm/top-user-agents@2.1.91/src/desktop.json').then(r => r.json());

// Get document, or throw exception on error
(async () => {
  try {
    const data = v.parse(LinksDocumentSchema, yaml.load(fs.readFileSync('./src/links.yml', 'utf-8')));

    // Run checks in chunks to limit concurrency
    const entries = Object.entries(data);
    await queue.all(entries.map(async ([key, val]) => {
      const alive = await checkAlive(val.url, 5000);
      val.alive = alive === CheckStatus.Alive;
    }));

    fs.mkdirSync('./dist', { recursive: true });
    fs.writeFileSync('./dist/links.json', JSON.stringify(data));
    fs.cpSync('./src/img', './dist/img', { recursive: true });

    fs.writeFileSync('./dist/_headers', fastStringArrayJoin([
      '/links.json',
      '  Cache-Control: public, max-age=300, stale-while-revalidate=60',
      '/img/*',
      '  Cache-Control: public, max-age=86400, stale-while-revalidate=3600',
    ], '\n') + '\n');
  } catch (e) {
    console.error(e);
  }
})();

const enum CheckStatus {
  Alive,
  Dead,
  Redirected
}

async function checkAlive(url: string, timeoutMs = 5000): Promise<CheckStatus> {
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal, headers: { 'User-Agent': 'Mozilla/5.0 Sukka Friends Link Checker (https://skk.moe/friends/; https://github.com/SukkaW/Friends)' } });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal });
      }
      if (res.ok) {
        console.log(`[alive] ${url}`);
        return CheckStatus.Alive;
      }
      if (res.status >= 300 && res.status < 400) {
        console.log(`[redirected] ${url} -> ${res.headers.get('Location')}`);
        return CheckStatus.Redirected;
      }

      console.log(`[dead] ${url} (status: ${res.status})`);
      return CheckStatus.Dead;
    } finally {
      // AbortSignal.timeout cleans itself up; no manual timeout clearing required.
    }
  } catch (e) {
    return CheckStatus.Dead;
  }
}


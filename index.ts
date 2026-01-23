import yaml from 'js-yaml';
import fs from 'fs';
import { fastStringArrayJoin } from 'foxts/fast-string-array-join';

// Get document, or throw exception on error
(() => {
  try {
    const doc = yaml.load(fs.readFileSync('./src/links.yml', 'utf-8'));
    fs.mkdirSync('./dist', { recursive: true });
    fs.writeFileSync('./dist/links.json', JSON.stringify(doc));

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

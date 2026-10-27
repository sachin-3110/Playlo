import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.DOMParser = dom.window.DOMParser;
globalThis.Element = dom.window.Element;
globalThis.SVGElement = dom.window.SVGElement;

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false });

import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../../', import.meta.url)); // the docs/ folder
let total = 0, bad = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const text = readFileSync(join(dir, f), 'utf8');
  const blocks = [...text.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const [i, b] of blocks.entries()) {
    total++;
    try {
      await mermaid.parse(b);
      console.log(`ok    ${f} #${i + 1} (${b.split('\n')[0].trim()})`);
    } catch (e) {
      bad++;
      console.log(`FAIL  ${f} #${i + 1}: ${String(e.message ?? e).split('\n').slice(0, 4).join(' | ')}`);
    }
  }
}
console.log(`\n${total} diagrams, ${bad} failed`);
process.exit(bad ? 1 : 0);

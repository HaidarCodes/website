import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const publicDir = join(root, 'public');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const html = read('public', 'index.html');
const css = read('public', 'css', 'style.css');
const scripts = readdirSync(join(publicDir, 'js')).filter((name) => name.endsWith('.js'));

describe('index.html', () => {
  it('shows the contact address as a mailto link', () => {
    assert.match(html, /<a\b[^>]*href="mailto:@@CONTACT_EMAIL@@"/);
    assert.match(html, />@@CONTACT_EMAIL@@</);
  });

  it('keeps the "Coming soon!" note from the previous page', () => {
    assert.match(html, />Coming soon!</);
  });

  it('declares language, viewport and title', () => {
    assert.match(html, /<html lang="de">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
    assert.match(html, /<title>@@SITE_NAME@@<\/title>/);
  });

  it('works with the strict CSP: no inline scripts, styles or event handlers', () => {
    for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
      assert.match(tag, /\bsrc="/, `inline script: ${tag}`);
    }
    assert.doesNotMatch(html, /<style\b/);
    assert.doesNotMatch(html, /\sstyle="/);
    assert.doesNotMatch(html, /\son[a-z]+="/);
  });

  it('only references local assets that exist', () => {
    const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(references.length > 0);
    for (const reference of references) {
      if (reference.startsWith('mailto:')) {
        continue;
      }
      assert.doesNotMatch(reference, /^(?:[a-z]+:)?\/\//i, `external asset: ${reference}`);
      assert.ok(existsSync(join(publicDir, reference)), `missing asset: ${reference}`);
    }
  });

  it('hides the decorative canvas from assistive technology', () => {
    assert.match(html, /<canvas\b[^>]*aria-hidden="true"/);
  });
});

describe('style.css', () => {
  it('loads nothing from other origins', () => {
    assert.doesNotMatch(css, /@import\b/);
    assert.doesNotMatch(css, /url\(\s*['"]?(?:[a-z]+:)?\/\//i);
  });

  it('respects reduced-motion and forced-colors preferences', () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /@media \(forced-colors: active\)/);
  });
});

describe('JavaScript modules', () => {
  it('only import local modules that exist', () => {
    for (const name of scripts) {
      const source = read('public', 'js', name);
      for (const [, specifier] of source.matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)) {
        assert.ok(specifier.startsWith('./'), `${name} imports non-local module ${specifier}`);
        assert.ok(
          existsSync(resolve(dirname(join(publicDir, 'js', name)), specifier)),
          `${name} imports missing module ${specifier}`,
        );
      }
      assert.doesNotMatch(source, /\bimport\s*\(/, `${name} uses a dynamic import`);
    }
  });

  it('avoid code-evaluation and HTML-injection sinks', () => {
    for (const name of scripts) {
      const source = read('public', 'js', name);
      assert.doesNotMatch(source, /\beval\s*\(|new Function\b|\.innerHTML\b|\.outerHTML\b|document\.write\b/, name);
    }
  });

  it('are all covered by the syntax check script', () => {
    const check = JSON.parse(read('package.json')).scripts.check;
    for (const name of scripts) {
      assert.ok(check.includes(`public/js/${name}`), `npm run check misses ${name}`);
    }
  });
});

describe('README files', () => {
  const english = read('README.md');
  const german = read('README.de.md');

  it('provides concise English and German versions with reciprocal links', () => {
    assert.match(english, /^\[English\].*\[Deutsch\]/m);
    assert.match(german, /^\[English\].*\[Deutsch\]/m);
    assert.match(english, /README\.de\.md/);
    assert.match(german, /README\.md/);
  });

  it('does not publish real contact addresses in tracked documentation', () => {
    const publicEmail =
      /\b[A-Z0-9._%+-]+@(?!(?:example\.invalid)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    assert.doesNotMatch(english, publicEmail);
    assert.doesNotMatch(german, publicEmail);
  });
});

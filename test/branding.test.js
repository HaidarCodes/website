import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { describe, it } from 'node:test';

const script = readFileSync(new URL('../scripts/validate-branding.sh', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');
const missingShell = process.platform === 'win32'
  && spawnSync('sh', ['-c', ':']).error?.code === 'ENOENT';

function validate(values) {
  const env = { ...process.env, PUBLIC_SITE_NAME: 'Website', PUBLIC_CONTACT_EMAIL: 'contact@example.invalid' };
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete env[name];
    } else {
      env[name] = value;
    }
  }
  const result = spawnSync('sh', ['-s'], { input: script, env, encoding: 'utf8' });
  assert.ifError(result.error);
  return result;
}

describe('branding validation', { skip: missingShell && 'Requires a POSIX sh on PATH (available in Git for Windows).' }, () => {
  for (const values of [
    {},
    { PUBLIC_SITE_NAME: 'example.invalid', PUBLIC_CONTACT_EMAIL: 'hello+website@example.invalid' },
    { PUBLIC_SITE_NAME: 'a'.repeat(253), PUBLIC_CONTACT_EMAIL: `${'a'.repeat(238)}@example.invalid` },
  ]) {
    it('accepts supported branding without printing values', () => {
      const result = validate(values);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, '');
    });
  }

  const invalid = [
    ['PUBLIC_SITE_NAME', undefined, 'is required'],
    ['PUBLIC_SITE_NAME', '', 'is required'],
    ['PUBLIC_SITE_NAME', 'https://example.invalid', 'only ASCII letters'],
    ['PUBLIC_SITE_NAME', 'My Website', 'only ASCII letters'],
    ['PUBLIC_SITE_NAME', 'example.invalid\n', 'only ASCII letters'],
    ['PUBLIC_SITE_NAME', 'example.invalid\r\n', 'only ASCII letters'],
    ['PUBLIC_SITE_NAME', '<script>', 'only ASCII letters'],
    ['PUBLIC_SITE_NAME', 'a'.repeat(254), 'at most 253'],
    ['PUBLIC_CONTACT_EMAIL', undefined, 'is required'],
    ['PUBLIC_CONTACT_EMAIL', '', 'is required'],
    ['PUBLIC_CONTACT_EMAIL', 'mailto:contact@example.invalid', 'plain ASCII email'],
    ['PUBLIC_CONTACT_EMAIL', 'Contact <contact@example.invalid>', 'plain ASCII email'],
    ['PUBLIC_CONTACT_EMAIL', 'contact@example.invalid\n', 'plain ASCII email'],
    ['PUBLIC_CONTACT_EMAIL', 'contact@example.invalid\r\n', 'plain ASCII email'],
    ['PUBLIC_CONTACT_EMAIL', 'contact&other@example.invalid', 'plain ASCII email'],
    ['PUBLIC_CONTACT_EMAIL', 'contact.example.invalid', 'must match'],
    ['PUBLIC_CONTACT_EMAIL', 'contact@@example.invalid', 'must match'],
    ['PUBLIC_CONTACT_EMAIL', 'contact@example.x', 'must match'],
    ['PUBLIC_CONTACT_EMAIL', `${'a'.repeat(239)}@example.invalid`, 'at most 254'],
  ];

  for (const [name, value, message] of invalid) {
    it(`rejects invalid ${name} with a value-free diagnostic (${message})`, () => {
      const result = validate({ [name]: value });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.ok(result.stderr.includes(name), result.stderr);
      assert.ok(result.stderr.includes(message), result.stderr);
      assert.match(result.stderr, /^Branding configuration error: [^\n]+\n$/);
      if (value) {
        assert.ok(!result.stderr.includes(value), 'Diagnostic must not include the configured value.');
      }
    });
  }
});

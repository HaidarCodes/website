import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
// Normalised so the checks behave the same on Windows checkouts with CRLF line endings.
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');

const workflowDir = join(root, '.github', 'workflows');
const workflows = readdirSync(workflowDir)
  .filter((name) => name.endsWith('.yml'))
  .map((name) => ({ name, source: read('.github', 'workflows', name) }));

describe('GitHub workflows', () => {
  it('exist for CI and deployment', () => {
    assert.deepEqual(workflows.map(({ name }) => name).sort(), ['ci.yml', 'deploy.yml']);
  });

  it('pin every action to a full commit SHA', () => {
    for (const { name, source } of workflows) {
      for (const [, action] of source.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)/gm)) {
        assert.match(action, /@[0-9a-f]{40}$/, `${name} uses unpinned action ${action}`);
      }
    }
  });

  it('run with read-only permissions and without persisted checkout credentials', () => {
    for (const { name, source } of workflows) {
      assert.match(source, /^permissions:\n {2}contents: read$/m, name);
      assert.doesNotMatch(source, /:\s*write\b/, `${name} requests write permissions`);
      const checkouts = source.match(/uses: actions\/checkout@/g) ?? [];
      const hardened = source.match(/persist-credentials: false/g) ?? [];
      assert.equal(hardened.length, checkouts.length, `${name} persists checkout credentials`);
    }
  });

  it('deploy only tested pushes to the default branch', () => {
    const deploy = read('.github', 'workflows', 'deploy.yml');
    const ci = read('.github', 'workflows', 'ci.yml');
    assert.match(deploy, /workflow_run\.conclusion == 'success'/);
    assert.match(deploy, /workflow_run\.event == 'push'/);
    assert.match(deploy, /workflow_run\.head_branch == 'main'/);
    assert.match(ci, /branches: \[main\]/);
    assert.match(deploy, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
    assert.match(deploy, /environment: production/);
  });
});

describe('container', () => {
  it('builds from a digest-pinned unprivileged base image', () => {
    assert.match(read('Dockerfile'), /^FROM nginxinc\/nginx-unprivileged:[^\s@]+@sha256:[0-9a-f]{64}$/m);
  });

  it('runs hardened behind the proxy network without published ports', () => {
    const compose = read('compose.yaml');
    assert.match(compose, /read_only: true/);
    assert.match(compose, /cap_drop:\n\s+- ALL/);
    assert.match(compose, /no-new-privileges:true/);
    assert.doesNotMatch(compose, /^\s+ports:/m);
  });

  it('sends a strict content security policy', () => {
    const nginx = read('nginx', 'default.conf');
    assert.match(nginx, /Content-Security-Policy "default-src 'none'; script-src 'self'/);
    assert.doesNotMatch(nginx, /unsafe-(?:inline|eval)/);
    assert.match(nginx, /server_tokens off;/);
  });

  it('renders public branding from BuildKit secrets rather than tracked source', () => {
    const html = read('public', 'index.html');
    const dockerfile = read('Dockerfile');
    const deploy = read('.github', 'workflows', 'deploy.yml');
    assert.match(html, /@@SITE_NAME@@/);
    assert.match(html, /@@CONTACT_EMAIL@@/);
    assert.doesNotMatch(html, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    assert.match(dockerfile, /--mount=type=secret,id=public_site_name/);
    assert.match(dockerfile, /--mount=type=secret,id=public_contact_email/);
    assert.match(deploy, /secrets\.PUBLIC_SITE_NAME/);
    assert.match(deploy, /secrets\.PUBLIC_CONTACT_EMAIL/);
    assert.match(deploy, /docker build --pull --no-cache/);
    assert.match(deploy, /--secret id=public_site_name,env=PUBLIC_SITE_NAME/);
    assert.match(deploy, /--secret id=public_contact_email,env=PUBLIC_CONTACT_EMAIL/);
  });

  it('validates branding before deployment and uses the same validator in the image build', () => {
    const deploy = read('.github', 'workflows', 'deploy.yml');
    const dockerfile = read('Dockerfile');
    assert.match(deploy, /sh scripts\/validate-branding\.sh/);
    assert.ok(deploy.indexOf('sh scripts/validate-branding.sh') < deploy.indexOf('docker build'));
    assert.match(dockerfile, /--mount=type=bind,source=scripts\/validate-branding\.sh,target=\/tmp\/validate-branding\.sh/);
    assert.match(dockerfile, /PUBLIC_SITE_NAME="\$site_name" PUBLIC_CONTACT_EMAIL="\$contact_email" \\\n\s+sh \/tmp\/validate-branding\.sh;/);
    assert.match(read('.dockerignore'), /^!scripts\/validate-branding\.sh$/m);
  });
});

describe('dependencies', () => {
  const manifest = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));

  it('have no runtime dependencies and exactly pinned dev dependencies', () => {
    assert.equal(manifest.dependencies, undefined);
    for (const [name, version] of Object.entries(manifest.devDependencies)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${name} is not pinned exactly`);
    }
  });

  it('never run install scripts', () => {
    assert.match(read('.npmrc'), /^ignore-scripts=true$/m);
  });

  it('resolve only from the npm registry with integrity hashes', () => {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path === '') {
        continue;
      }
      assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/'), `${path} from ${entry.resolved}`);
      assert.match(entry.integrity ?? '', /^sha512-/, `${path} lacks an integrity hash`);
    }
  });
});

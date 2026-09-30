/**
 * Validation middleware unit tests
 * Tests input sanitization and validation chains without requiring MongoDB
 */

const { sanitizeInput } = require('../middleware/validation');

describe('Input Sanitization', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, query: {}, params: {} };
    res = {};
    next = jest.fn();
  });

  test('removes script tags from body strings', () => {
    req.body = { name: 'hello<script>alert("xss")</script>world' };
    sanitizeInput(req, res, next);
    expect(req.body.name).not.toContain('<script>');
    expect(req.body.name).toContain('hello');
    expect(req.body.name).toContain('world');
    expect(next).toHaveBeenCalled();
  });

  test('removes javascript: protocol', () => {
    req.body = { url: 'javascript:alert(1)' };
    sanitizeInput(req, res, next);
    expect(req.body.url).not.toContain('javascript:');
    expect(next).toHaveBeenCalled();
  });

  test('removes event handlers', () => {
    req.body = { html: '<img onerror=alert(1)>' };
    sanitizeInput(req, res, next);
    expect(req.body.html).not.toMatch(/onerror\s*=/i);
    expect(next).toHaveBeenCalled();
  });

  test('recursively sanitizes nested objects', () => {
    req.body = {
      project: {
        name: 'test<script>xss</script>',
        config: {
          command: 'javascript:void(0)'
        }
      }
    };
    sanitizeInput(req, res, next);
    expect(req.body.project.name).not.toContain('<script>');
    expect(req.body.project.config.command).not.toContain('javascript:');
  });

  test('recursively sanitizes arrays', () => {
    req.body = {
      tags: ['safe', '<script>alert(1)</script>', 'also-safe']
    };
    sanitizeInput(req, res, next);
    expect(req.body.tags[1]).not.toContain('<script>');
    expect(req.body.tags[0]).toBe('safe');
    expect(req.body.tags[2]).toBe('also-safe');
  });

  test('preserves non-string values', () => {
    req.body = { count: 42, active: true, ratio: 3.14 };
    sanitizeInput(req, res, next);
    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.ratio).toBe(3.14);
  });

  test('trims whitespace from strings', () => {
    req.body = { name: '  hello world  ' };
    sanitizeInput(req, res, next);
    expect(req.body.name).toBe('hello world');
  });

  test('sanitizes query params', () => {
    req.query = { search: '<script>alert(1)</script>' };
    sanitizeInput(req, res, next);
    expect(req.query.search).not.toContain('<script>');
  });

  test('sanitizes route params', () => {
    req.params = { id: 'javascript:alert(1)' };
    sanitizeInput(req, res, next);
    expect(req.params.id).not.toContain('javascript:');
  });

  test('handles null body gracefully', () => {
    req.body = null;
    sanitizeInput(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('Branch Name Validation', () => {
  // Branch names used in git clone commands must be safe
  const validBranchRegex = /^[a-zA-Z0-9\-_\/\.]+$/;

  test('accepts valid branch names', () => {
    const valid = ['main', 'develop', 'feature/new-auth', 'release-1.0', 'v2.3.1', 'fix_bug'];
    valid.forEach(name => {
      expect(name).toMatch(validBranchRegex);
    });
  });

  test('rejects branch names with shell metacharacters', () => {
    const invalid = [
      'main; rm -rf /',
      'main$(whoami)',
      'main`id`',
      'main | cat /etc/passwd',
      'main && echo pwned',
      'main\nnewline',
      'main<>pipe',
      'main"quoted"',
      "main'quoted'",
    ];
    invalid.forEach(name => {
      expect(name).not.toMatch(validBranchRegex);
    });
  });
});

describe('Project Name Validation', () => {
  const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-_. ]*$/;

  test('accepts valid project names', () => {
    const valid = ['my-project', 'MyApp', 'project_v2', 'My App 2.0'];
    valid.forEach(name => {
      expect(name).toMatch(validNameRegex);
    });
  });

  test('rejects names with shell injection', () => {
    const invalid = ['; rm -rf /', '$(whoami)', '`id`'];
    invalid.forEach(name => {
      expect(name).not.toMatch(validNameRegex);
    });
  });
});

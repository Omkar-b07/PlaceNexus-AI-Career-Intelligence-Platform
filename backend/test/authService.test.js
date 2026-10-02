import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordHash } from '../src/services/authService.js';

test('creates the shared scrypt password format without retaining plaintext', async () => {
  const password = 'Development-password-123';
  const passwordHash = await createPasswordHash(password);
  const [salt, derivedKey, extraPart] = passwordHash.split(':');

  assert.equal(extraPart, undefined);
  assert.equal(Buffer.from(salt, 'base64').length, 16);
  assert.equal(Buffer.from(derivedKey, 'base64').length, 64);
  assert.equal(passwordHash.includes(password), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { allowRoles, validateUserFields } from './middleware.js';

function responseMock() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function runUserValidation(body) {
  const req = { body };
  const res = responseMock();
  let nextCalled = false;
  for (const [index, middleware] of validateUserFields.entries()) {
    let continued = false;
    middleware(req, res, () => {
      continued = true;
      if (index === validateUserFields.length - 1) nextCalled = true;
    });
    if (!continued) break;
  }
  return { req, res, nextCalled };
}

test('user validation trims and normalizes valid identity fields', () => {
  const { req, res, nextCalled } = runUserValidation({
    name: '  A Customer Name Long Enough  ',
    email: '  SHOPPER@example.com ',
    address: '  42 Garden Road  ',
    password: 'ValidPass1!'
  });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.body.name, 'A Customer Name Long Enough');
  assert.equal(req.body.email, 'shopper@example.com');
  assert.equal(req.body.address, '42 Garden Road');
});

test('user validation rejects short names and missing passwords', () => {
  const { res, nextCalled } = runUserValidation({
    name: 'Too short',
    email: 'shopper@example.com',
    address: ''
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.errors.map(({ field }) => field), ['name', 'password']);
});

test('user validation rejects passwords without uppercase and special characters', () => {
  const { res, nextCalled } = runUserValidation({
    name: 'A Customer Name Long Enough',
    email: 'shopper@example.com',
    address: '',
    password: 'lowercaseonly'
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.errors.some(({ field }) => field === 'password'));
});

test('role authorization denies access outside the allowed roles', () => {
  const req = { user: { role: 'user' } };
  const res = responseMock();
  let nextCalled = false;
  allowRoles('admin')(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const normalizeLicenseResponse = require('../electron/services/license-response');

test('unwraps the server response envelope before license signature validation', () => {
  const license = {
    license_id: 'license-1',
    plan: 'enterprise',
  };
  const signature = 'signed-payload';

  assert.deepEqual(
    normalizeLicenseResponse({
      data: {
        success: true,
        data: license,
        signature,
      },
      code: 200,
      msg: 'success',
    }),
    {
      success: true,
      data: license,
      signature,
    },
  );
});

test('keeps a direct license response unchanged', () => {
  const response = {
    success: true,
    data: { license_id: 'license-1' },
    signature: 'signed-payload',
  };

  assert.deepEqual(normalizeLicenseResponse(response), response);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const AliyunDnsProvider = require('../electron/services/dns-providers/aliyun');

test('limits LastOperationNotFinished retries without overflowing the call stack', async () => {
  const provider = new AliyunDnsProvider({
    accessKeyId: 'test-ak',
    accessKeySecret: 'test-sk',
    maxOperationAttempts: 3,
    operationRetryDelayMs: 0,
  });
  let attempts = 0;

  provider.client = {
    request: async () => {
      attempts += 1;
      const error = new Error('operation is still running');
      error.code = 'LastOperationNotFinished';
      throw error;
    },
  };

  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (callback) => {
    callback();
    return 0;
  };

  try {
    await assert.rejects(
      provider.createRecord({
        domain: 'example.com',
        rr: '_acme-challenge',
        value: 'token',
        type: 'TXT',
      }),
      /LastOperationNotFinished|operation is still running/,
    );
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  assert.equal(attempts, 3);
});

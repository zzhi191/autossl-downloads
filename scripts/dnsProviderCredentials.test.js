const test = require('node:test')
const assert = require('node:assert/strict')

const {
  getProviderCredentials,
  saveProviderCredentials
} = require('../electron/services/dns-provider-credentials')

class MemoryStore {
  constructor() {
    this.data = new Map()
  }

  get(key, fallbackValue) {
    return this.data.has(key) ? this.data.get(key) : fallbackValue
  }

  set(key, value) {
    this.data.set(key, value)
  }
}

test('stores the latest DNS credentials independently for each provider', () => {
  const store = new MemoryStore()

  saveProviderCredentials(store, {
    type: 'aliyun',
    accessKeyId: 'aliyun-key-1',
    accessKeySecret: 'aliyun-secret-1'
  })
  saveProviderCredentials(store, {
    type: 'tencent',
    accessKeyId: 'tencent-key-1',
    accessKeySecret: 'tencent-secret-1'
  })
  saveProviderCredentials(store, {
    type: 'aliyun',
    accessKeyId: 'aliyun-key-2',
    accessKeySecret: 'aliyun-secret-2'
  })

  assert.deepEqual(getProviderCredentials(store, 'aliyun'), {
    type: 'aliyun',
    accessKeyId: 'aliyun-key-2',
    accessKeySecret: 'aliyun-secret-2'
  })
  assert.deepEqual(getProviderCredentials(store, 'tencent'), {
    type: 'tencent',
    accessKeyId: 'tencent-key-1',
    accessKeySecret: 'tencent-secret-1'
  })
})

test('uses a successful certificate configuration before an unverified provider cache', () => {
  const store = new MemoryStore()
  saveProviderCredentials(store, {
    type: 'aliyun',
    accessKeyId: 'unverified-key',
    accessKeySecret: 'unverified-secret'
  })

  assert.deepEqual(getProviderCredentials(store, 'aliyun', {
    provider: 'aliyun',
    accessKeyId: 'verified-key',
    accessKeySecret: 'verified-secret'
  }), {
    type: 'aliyun',
    accessKeyId: 'verified-key',
    accessKeySecret: 'verified-secret'
  })
  assert.deepEqual(getProviderCredentials(store, 'aliyun'), {
    type: 'aliyun',
    accessKeyId: 'verified-key',
    accessKeySecret: 'verified-secret'
  })
})

test('does not cache an incomplete DNS credential', () => {
  const store = new MemoryStore()

  assert.equal(saveProviderCredentials(store, {
    type: 'aliyun',
    accessKeyId: 'aliyun-key-1',
    accessKeySecret: ''
  }), false)
  assert.equal(getProviderCredentials(store, 'aliyun'), null)
})

test('seeds an empty provider cache from the latest successful certificate configuration', () => {
  const store = new MemoryStore()

  assert.deepEqual(getProviderCredentials(store, 'aliyun', {
    provider: 'aliyun',
    accessKeyId: 'saved-aliyun-key',
    accessKeySecret: 'saved-aliyun-secret'
  }), {
    type: 'aliyun',
    accessKeyId: 'saved-aliyun-key',
    accessKeySecret: 'saved-aliyun-secret'
  })
  assert.deepEqual(getProviderCredentials(store, 'aliyun'), {
    type: 'aliyun',
    accessKeyId: 'saved-aliyun-key',
    accessKeySecret: 'saved-aliyun-secret'
  })
})

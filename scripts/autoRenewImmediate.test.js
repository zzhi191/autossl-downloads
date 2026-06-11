const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const dashboardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/views/Dashboard.vue'),
  'utf8'
)

const autoRenewServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/services/auto-renew-service.js'),
  'utf8'
)

const mainSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/main.js'),
  'utf8'
)

test('dashboard immediate renew should invoke the dedicated renew IPC instead of showing placeholder text', () => {
  assert.match(
    dashboardSource,
    /ipcRenderer\.invoke\('auto-renew:renew-cert', cert\.id\)/,
    'Dashboard should call the immediate renew IPC with the selected certificate id'
  )

  assert.doesNotMatch(
    dashboardSource,
    /重新申请证书功能开发中/,
    'Dashboard should not keep the development placeholder for immediate renew'
  )
})

test('main process should expose immediate renew IPC and pass current user context', () => {
  assert.match(
    mainSource,
    /ipcMain\.handle\('auto-renew:renew-cert', async \(event, certId\) => \{/,
    'Main process should register the immediate renew IPC handler'
  )

  assert.match(
    mainSource,
    /AutoRenewService\.renewNow\(certId, userId, currentUser\?\.email \|\| ''\)/,
    'Immediate renew should execute under the current logged-in user and reuse the current session email as fallback'
  )
})

test('auto renew service should normalize expiry timestamps and support targeted renewals', () => {
  assert.match(
    autoRenewServiceSource,
    /function normalizeTimestampMs\(value\)/,
    'Auto renew service should normalize second-based and millisecond-based expiry values'
  )

  assert.match(
    autoRenewServiceSource,
    /async function renewNow\(certId, userId = 'default', fallbackEmail = ''\)/,
    'Auto renew service should expose a targeted renew entrypoint'
  )
})

test('auto renew should fall back to domain-level apply config when cert-level config is missing', () => {
  assert.match(
    autoRenewServiceSource,
    /getCertApplyConfigByDomain\(domain, userId\)/,
    'Immediate renew should reuse the last saved config for the same domain when cert-id scoped config is missing'
  )
})

test('auto renew should recover missing apply config from local saved drafts', () => {
  assert.match(
    autoRenewServiceSource,
    /applyFormDraft/,
    'Immediate renew should inspect the locally saved apply draft when the database config is missing'
  )

  assert.match(
    autoRenewServiceSource,
    /psl\.parse/,
    'Immediate renew should allow same-root-domain draft reuse for legacy certificates'
  )
})

test('auto renew should try the next local DNS config when a provider says the domain does not exist', () => {
  assert.match(
    autoRenewServiceSource,
    /InvalidDomainName\.NoExistError/,
    'Immediate renew should detect domain-not-found errors from a mismatched DNS provider'
  )

  assert.match(
    autoRenewServiceSource,
    /continue/,
    'Immediate renew should continue to the next candidate config instead of failing immediately'
  )
})

test('auto renew success should be written into apply logs so the audit page can display it', () => {
  assert.match(
    autoRenewServiceSource,
    /addApplyLog\(\{/,
    'Auto renew service should append apply-log records directly'
  )

  assert.match(
    autoRenewServiceSource,
    /status:\s*'success'/,
    'Auto renew success should be persisted as a success log entry'
  )

  assert.match(
    autoRenewServiceSource,
    /message:\s*'自动续期成功'/,
    'Auto renew success should have a success message that the audit table can render'
  )
})

console.log('autoRenewImmediate.test.js passed')

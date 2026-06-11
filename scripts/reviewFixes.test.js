const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8')

const mainSource = read('electron/main.js')
const preloadSource = read('electron/preload.js')
const dbSource = read('electron/db.js')
const licenseSource = read('electron/services/license-service.js')
const autoRenewSource = read('electron/services/auto-renew-service.js')

test('auto renew should not fall back to admin config storage for non-admin users', () => {
  assert.doesNotMatch(autoRenewSource, /config-admin/, 'non-admin renewals should not probe admin config storage')
})

test('certificate delete and deployment lookups should stay user-scoped', () => {
  assert.match(dbSource, /deleteCert\(id,\s*userId\)/, 'certificate deletion should accept a user id')
  assert.match(dbSource, /getCertDeployedServers\(certId,\s*userId\)/, 'deployment lookup should accept a user id')
  assert.match(dbSource, /addCertServerDeployment\(certId,\s*serverId,\s*certPath,\s*keyPath,\s*passphrase,\s*userId\)/, 'deployment inserts should accept a user id')
  assert.match(dbSource, /removeCertServerDeployment\(certId,\s*serverId,\s*userId\)/, 'deployment deletes should accept a user id')

  assert.match(mainSource, /certdDB\.deleteCert\(id,\s*userId\)/, 'IPC delete should pass the active user id')
  assert.match(mainSource, /certdDB\.getCertDeployedServers\(certId,\s*userId\)/, 'IPC deployed-server lookup should pass the active user id')
  assert.match(mainSource, /certdDB\.addCertServerDeployment\(certId,\s*serverId,\s*certPath,\s*keyPath,\s*passphrase,\s*userId\)/, 'IPC deployment insert should pass the active user id')
  assert.match(mainSource, /certdDB\.removeCertServerDeployment\(certId,\s*serverId,\s*userId\)/, 'IPC deployment delete should pass the active user id')
})

test('license refresh should clear stale cache when cloud reports no active license', () => {
  assert.match(licenseSource, /No active license found|no active license/i, 'license service should recognize the no-license response')
  assert.match(licenseSource, /store\.delete\(STORE_KEY\)|clear.*STORE_KEY/i, 'license service should clear cached license state')
})

test('activation should return the frontend-compatible response shape', () => {
  assert.match(licenseSource, /return \{\s*valid:\s*false,\s*reason:/, 'activation errors should expose reason for the UI')
  assert.match(licenseSource, /return \{\s*valid:\s*true,\s*license:/, 'activation success should expose valid/ license')
})

test('scheduled auto renew should use the active user id', () => {
  assert.match(mainSource, /AutoRenewService\.init\(certdDB,\s*AcmeService,\s*SshService,\s*\(\)\s*=>\s*currentUser\?\.id/, 'auto-renew init should receive a user-id resolver')
  assert.match(autoRenewSource, /checkAndRenew\(getCurrentUserId\(\)\)/, 'timer checks should run under the active user context')
})

test('server and cert saves should reject ids owned by another user instead of reassigning ownership', () => {
  assert.match(dbSource, /getServerOwner\(id\)/, 'db should expose server ownership lookups')
  assert.match(dbSource, /getCertOwner\(id\)/, 'db should expose cert ownership lookups')
  assert.match(mainSource, /ownerUserId && ownerUserId !== userId/, 'main process should block cross-user ownership reassignment')
  assert.match(mainSource, /该服务器ID已被其他账户占用|服务器不存在或无权限访问/, 'server save path should surface a clear ownership error')
  assert.match(mainSource, /该证书ID已被其他账户占用|证书不存在或无权限访问/, 'cert save path should surface a clear ownership error')
})

test('ordinary session restore should not auto-claim admin legacy data', () => {
  assert.doesNotMatch(
    mainSource,
    /ipcMain\.handle\('user:set-session'[\s\S]*claimLegacyData\(userId\)/,
    'logging in as a normal remote user should not automatically transfer all legacy admin-owned local data'
  )
})

test('offline license trust should be bounded by a seven day grace period', () => {
  assert.match(licenseSource, /OFFLINE_GRACE_DAYS\s*=\s*7|OFFLINE_GRACE_MS/, 'license service should define an offline grace window')
  assert.match(licenseSource, /lastVerified|last_verified/, 'license service should track when online verification last succeeded')
  assert.match(licenseSource, /offlineSince|offline_since/, 'license service should track when offline mode started')
  assert.match(licenseSource, /grace|7 \* 24 \* 60 \* 60 \* 1000/, 'offline trust should be time-bounded rather than indefinite')
})

test('preload whitelist should allow renderer channels that are actively used in the UI', () => {
  assert.match(preloadSource, /'dialog:open-file'/, 'file picker channel should be whitelisted because Servers view uses it')
  assert.match(preloadSource, /'cert:remove-deployment'/, 'deployment removal channel should be whitelisted because Certificates view uses it')
})

test('main process should not keep dead handlers with no implementation behind them', () => {
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('server:get-certs'/, 'unused server:get-certs handler should be removed until it has a real implementation')
})

console.log('reviewFixes.test.js passed')

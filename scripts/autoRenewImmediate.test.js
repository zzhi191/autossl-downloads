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

const acmeServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/services/acme-service.js'),
  'utf8'
)

const mainSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/main.js'),
  'utf8'
)

const dbSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/db.js'),
  'utf8'
)

const certificatesSource = fs.readFileSync(
  path.resolve(__dirname, '../src/views/Certificates.vue'),
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
    /AutoRenewService\.renewNow\(certId, userId, currentUser\?\.email \|\| '',/,
    'Immediate renew should execute under the current logged-in user, reuse the current session email as fallback, and pass progress'
  )
})

test('manual certificate apply should return a defined success message', () => {
  const applyHandlerSource = mainSource.slice(
    mainSource.indexOf("ipcMain.handle('acme:apply'"),
    mainSource.indexOf('// ==================== 证书部署 ====================')
  )

  assert.doesNotMatch(
    applyHandlerSource,
    /message:\s*deployedMessage/,
    'Manual apply should not reference the deploy-only deployedMessage variable on the success path'
  )

  assert.match(
    applyHandlerSource,
    /message:\s*result\.message \|\| '证书申请成功'/,
    'Manual apply success should return the ACME success message'
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
    /async function renewNow\(certId, userId = 'default', fallbackEmail = '', onProgress = \(\) => \{\}\)/,
    'Auto renew service should expose a targeted renew entrypoint'
  )
})

test('auto renew should prepare a writable ACME runtime before issuing a certificate', () => {
  assert.match(
    autoRenewServiceSource,
    /function prepareAcmeRuntime\(\)[\s\S]*app\.getPath\('userData'\)[\s\S]*fs\.mkdirSync\(path\.join\(userDataPath, 'logs'\), \{ recursive: true \}\)[\s\S]*process\.chdir\(userDataPath\)/,
    'Auto renew should use the writable user-data directory for @certd logs'
  )

  const runtimeSetupIndex = autoRenewServiceSource.indexOf('prepareAcmeRuntime()\n    const { default: Store }')
  const applyCertIndex = autoRenewServiceSource.indexOf('AcmeService.applyCert(')
  assert.ok(
    runtimeSetupIndex >= 0 && runtimeSetupIndex < applyCertIndex,
    'Auto renew should prepare the ACME runtime before calling applyCert'
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

test('ACME DNS validation should wait for every authoritative nameserver to serve the TXT value', () => {
  assert.match(
    acmeServiceSource,
    /nsServers\.map\(async nsServer => \{[\s\S]*resolver\.setServers\(\[nsServer\]\)[\s\S]*resolveTxt\(fullDomain\)/,
    'DNS validation should query each authoritative nameserver independently'
  )
  assert.match(
    acmeServiceSource,
    /authoritativeResults\.every\(result => result\.includes\(dnsRecordValue\)\)/,
    'DNS validation should continue until every authoritative nameserver returns the expected value'
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

test('renewal flows should merge same-domain duplicates so the certificates page shows the newest status', () => {
  assert.match(
    dbSource,
    /mergeDuplicateCertsByDomain\(domain,\s*keepCertId,\s*userId\)/,
    'database layer should expose duplicate certificate merge support by domain'
  )

  assert.match(
    dbSource,
    /normalizeDuplicateCerts\(userId\)/,
    'database layer should normalize legacy duplicate certificate rows when loading the certificate list'
  )

  assert.match(
    mainSource,
    /mergeDuplicateCertsByDomain\(domain,\s*result\.certId,\s*userId\)/,
    'manual apply flow should collapse older same-domain certificate rows after saving the new certificate'
  )

  assert.match(
    autoRenewServiceSource,
    /mergeDuplicateCertsByDomain\(domain,\s*cert\.id,\s*userId\)/,
    'immediate renew flow should also collapse stale same-domain certificate rows'
  )
})

test('certificates page should wait for the refreshed certificate list after apply completes', () => {
  assert.match(
    certificatesSource,
    /const refreshCertListAfterChange = async \(domain,\s*expectedCertId = null,\s*retries = 4\) => \{/,
    'Certificates page should define a post-apply refresh helper'
  )

  assert.match(
    certificatesSource,
    /await refreshCertListAfterChange\(applyForm\.value\.domain,\s*certId\)/,
    'Certificates page should await a refreshed certificate list after apply succeeds'
  )
})

test('certificates page should expose a simple renew-plus-deploy action model', () => {
  assert.match(
    certificatesSource,
    /续期/,
    'Certificates page should label the renew action as 续期 for clarity'
  )

  assert.match(
    certificatesSource,
    /部署设置/,
    'Certificates page should expose deployment setup as a distinct action label'
  )

  assert.match(
    certificatesSource,
    /重新部署/,
    'Configured certificates should expose a direct redeploy action instead of a status-like label'
  )

  assert.match(
    certificatesSource,
    /已有部署配置，点击可重新部署或修改服务器和目录/,
    'Certificates page should explain that configured deployment entries remain editable'
  )

  assert.doesNotMatch(
    certificatesSource,
    /已配置/,
    'Certificates page should not use 已配置 as an action label because it hides the deploy entrypoint'
  )

  assert.match(
    certificatesSource,
    /续期成功后会自动部署到部署配置里的服务器/,
    'Certificates page should explicitly tell users that renewals auto-deploy to configured deployment targets'
  )

  assert.match(
    certificatesSource,
    /ipcRenderer\.invoke\('auto-renew:renew-cert', cert\.id\)/,
    'Certificates page should renew directly through the immediate renew IPC'
  )

  assert.doesNotMatch(
    certificatesSource,
    /重推/,
    'Certificates page should remove the overlapping 重推 action'
  )

  assert.doesNotMatch(
    certificatesSource,
    /重申/,
    'Certificates page should remove the confusing 重申 label in favor of direct renew'
  )
})

test('certificates page should distinguish deployment config from deployment success', () => {
  assert.match(
    certificatesSource,
    /const loadLatestDeployLog = async \(certId\)/,
    'Certificates page should load the latest deployment log for each certificate'
  )

  assert.match(
    certificatesSource,
    /最近部署失败/,
    'Certificates page should show failed deployment state instead of implying the config is successful'
  )

  assert.match(
    certificatesSource,
    /配置未部署/,
    'Certificates page should distinguish configured-but-not-deployed certificates'
  )
})

test('manual renewal should surface live progress logs in the certificates page', () => {
  assert.match(
    mainSource,
    /event\.sender\.send\('auto-renew:progress', progress\)/,
    'Main process should forward manual renew progress to the renderer'
  )

  assert.match(
    autoRenewServiceSource,
    /async function renewNow\(certId, userId = 'default', fallbackEmail = '', onProgress = \(\) => \{\}\)/,
    'Auto renew service should accept a progress callback for manual renewals'
  )

  assert.match(
    certificatesSource,
    /ipcRenderer\.on\('auto-renew:progress'/,
    'Certificates page should listen for manual renewal progress events'
  )

  assert.match(
    certificatesSource,
    /applyProgressVisible\.value = true/,
    'Certificates page should show the existing progress log modal during manual renewal'
  )
})

test('first-time apply should warn when deployment is not configured yet', () => {
  assert.match(
    certificatesSource,
    /const confirmApplyWithoutDeploy = \(\) => new Promise/,
    'Certificates page should define a confirmation flow for apply-without-deploy'
  )

  assert.match(
    certificatesSource,
    /建议先配置部署服务器和目录/,
    'Apply flow should recommend configuring deployment before the first certificate request'
  )

  assert.match(
    certificatesSource,
    /先去配置/,
    'Apply flow should offer an explicit path back to deployment configuration'
  )
})

test('certificates page should only allow deleting expired certificates', () => {
  assert.match(
    certificatesSource,
    /const canDeleteCert = \(cert\) => cert\?\.status === 'expired'/,
    'Certificates page should only treat expired rows as deletable'
  )

  assert.match(
    certificatesSource,
    /生效中的证书不允许删除，只有已过期证书才可以删除/,
    'Certificates page should explain why active certificates cannot be deleted'
  )
})

console.log('autoRenewImmediate.test.js passed')

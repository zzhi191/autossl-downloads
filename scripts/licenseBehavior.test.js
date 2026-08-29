const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const licenseServiceSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/services/license-service.js'),
  'utf8'
);
const mainSource = fs.readFileSync(
  path.resolve(__dirname, '../electron/main.js'),
  'utf8'
);
const appSource = fs.readFileSync(
  path.resolve(__dirname, '../src/App.vue'),
  'utf8'
);
const dashboardSource = fs.readFileSync(
  path.resolve(__dirname, '../src/views/Dashboard.vue'),
  'utf8'
);
const autoRenewSource = fs.readFileSync(
  path.resolve(__dirname, '../src/views/AutoRenew.vue'),
  'utf8'
);
const routerSource = fs.readFileSync(
  path.resolve(__dirname, '../src/router/index.js'),
  'utf8'
);
const licenseViewSource = fs.readFileSync(
  path.resolve(__dirname, '../src/views/License.vue'),
  'utf8'
);
const mainLayoutSource = fs.readFileSync(
  path.resolve(__dirname, '../src/components/MainLayout.vue'),
  'utf8'
);

test('license service should clear stale local cache only after an explicit no-license response', () => {
  assert.match(
    licenseServiceSource,
    /No active license found|no active license/i,
    'license refresh should recognize the explicit no-license response from the server'
  );
  assert.match(
    licenseServiceSource,
    /this\.store\.delete\(STORE_KEY\)/,
    'license refresh should clear stale cached entitlements after explicit revocation'
  );
});

test('machine id logic should keep compatibility with legacy machine ids', () => {
  assert.match(
    licenseServiceSource,
    /machineIdSync\(\)/,
    'license service should preserve or migrate legacy machine-id values'
  );
});

test('restoring a user session should not clear the machine-bound license cache', () => {
  assert.doesNotMatch(
    mainSource,
    /ipcMain\.handle\('user:set-session'[\s\S]*LicenseService\.clear\(\)/,
    'user session switching should not clear license state'
  );
});

test('app bootstrap should wait for license initialization before rendering routes', () => {
  assert.match(
    appSource,
    /<router-view\s+v-if="appReady"\s*\/>/,
    'App should delay route rendering until startup bootstrap finishes'
  );
  assert.match(
    appSource,
    /await window\.electron\.ipcRenderer\.invoke\('license:init'\)/,
    'App bootstrap should initialize license state before first page render'
  );
});

test('app bootstrap should not auto-enter a local admin data mode', () => {
  assert.doesNotMatch(
    appSource,
    /createLocalUserSession/,
    'App startup should not create a separate local admin session'
  );
  assert.doesNotMatch(
    appSource,
    /restoreLocalDataSession/,
    'App startup should not bypass remote login for local legacy data'
  );
  assert.doesNotMatch(
    appSource,
    /user:get-local-data-summary/,
    'App startup should not inspect local legacy data as an auth source'
  );
  assert.match(
    appSource,
    /isLocalAdminSession\(user\)[\s\S]*clearStoredSession\(\)/,
    'App startup should clear previously stored local admin sessions'
  );
});

test('logout should clear the remote session without managing a local auto-login mode', () => {
  assert.doesNotMatch(
    mainLayoutSource,
    /LOCAL_AUTO_LOGIN_SKIP_KEY|skipLocalAutoLogin/,
    'Logout should not need local admin auto-login flags'
  );
  assert.doesNotMatch(
    appSource,
    /LOCAL_AUTO_LOGIN_SKIP_KEY|skipLocalAutoLogin/,
    'App startup should not manage local admin auto-login flags'
  );
  assert.match(
    mainLayoutSource,
    /localStorage\.removeItem\('token'\)/,
    'Restoring a cloud user session should not clear the cloud token'
  );
});

test('feature pages should rely on app-level license bootstrap instead of re-initializing', () => {
  assert.doesNotMatch(
    dashboardSource,
    /license:init/,
    'Dashboard should not perform a second license bootstrap on mount'
  );
  assert.doesNotMatch(
    autoRenewSource,
    /license:init/,
    'AutoRenew should not perform a second license bootstrap on mount'
  );
});

test('software authorization page should be viewable with the local app session', () => {
  assert.doesNotMatch(
    routerSource,
    /path:\s*'\/license'[\s\S]*requiresCloudAuth:\s*true/,
    'License route should not force cloud auth before showing local license details'
  );

  assert.doesNotMatch(
    routerSource,
    /购买套餐需要云端登录，正在跳转到登录界面/,
    'Router should not redirect the software authorization page to login for purchase-only cloud auth'
  );
});

test('subscription purchase should still require cloud auth inside the license page', () => {
  assert.match(
    licenseViewSource,
    /const token = getCloudAuthToken\(\);[\s\S]*if \(!token\)/,
    'License purchase flow should check cloud auth when creating an order'
  );
});

test('paid users should see renewal and upgrade semantics before buying another plan', () => {
  assert.match(
    licenseViewSource,
    /const getPlanAction = \(plan\) =>/,
    'License page should classify plan actions before creating an order'
  );
  assert.match(
    licenseViewSource,
    /buttonText: '续费当前方案'/,
    'Same-level paid plans should be labeled as renewal'
  );
  assert.match(
    licenseViewSource,
    /buttonText: '升级方案'/,
    'Higher paid plans should be labeled as upgrades'
  );
  assert.match(
    licenseViewSource,
    /不会叠加/,
    'Renewal and upgrade copy should explain that resource quotas do not stack'
  );
  assert.match(
    licenseViewSource,
    /Modal\.confirm/,
    'Renewal and upgrade flows should require confirmation before payment'
  );
});

test('recommended plan badge should only be assigned to the middle displayed plan', () => {
  assert.match(
    licenseViewSource,
    /v-for="\s*\(p,\s*index\)\s+in\s+plans\s*"/,
    'Plan cards should expose their displayed index'
  );
  assert.match(
    licenseViewSource,
    /isRecommendedPlan\(index\)/,
    'Recommended styling should be based on the displayed plan index'
  );
  assert.doesNotMatch(
    licenseViewSource,
    /p\.price\s*>\s*100/,
    'Recommended styling should not mark every paid plan above a price threshold'
  );
});

test('plan cards should use a three-column layout and expose upgrade entitlement details', () => {
  assert.match(
    licenseViewSource,
    /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
    'Plan cards should fill the plan section as three columns on desktop'
  );
  assert.doesNotMatch(
    licenseViewSource,
    /grid-template-columns:\s*repeat\(4,\s*1fr\)/,
    'Plan cards should not reserve an empty fourth column'
  );
  assert.match(
    licenseViewSource,
    /QuestionCircleOutlined/,
    'Upgrade badge should include a help icon'
  );
  assert.match(
    licenseViewSource,
    /@click\.stop="showUpgradeInfo\(p\)"/,
    'Upgrade help should open details without triggering card purchase'
  );
  assert.match(
    licenseViewSource,
    /升级后总权益/,
    'Upgrade help modal should explain the post-upgrade entitlement'
  );
  assert.match(
    licenseViewSource,
    /currentCerts[\s\S]*targetCerts[\s\S]*currentServers[\s\S]*targetServers/,
    'Upgrade preview should compare current and target resource limits'
  );
});

test('main header should not show a separate cloud auth status next to an active license', () => {
  assert.doesNotMatch(
    mainLayoutSource,
    /cloud-auth-badge|cloudAuthLabel|云端未连接|云端登录|重新登录/,
    'Header should not mix cloud-token state with the local software license state'
  );
  assert.doesNotMatch(
    mainLayoutSource,
    /validateCloudAuth|\/auth\/me/,
    'Header should not perform a separate cloud-auth check just to render account status'
  );
});

console.log('licenseBehavior.test.js passed');

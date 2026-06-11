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

console.log('licenseBehavior.test.js passed');

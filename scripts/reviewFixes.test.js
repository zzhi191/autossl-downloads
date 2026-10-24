const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) =>
  fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
const readIfExists = (file) => {
  const fullPath = path.resolve(__dirname, "..", file);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
};

const mainSource = read("electron/main.js");
const preloadSource = read("electron/preload.js");
const dbSource = read("electron/db.js");
const licenseSource = read("electron/services/license-service.js");
const autoRenewSource = read("electron/services/auto-renew-service.js");
const loginSource = read("src/views/Login.vue");
const certificatesSource = read("src/views/Certificates.vue");
const serversSource = read("src/views/Servers.vue");
const sshSource = read("electron/services/ssh-service.js");
const packageSource = read("package.json");
const startScriptSource = read("start.sh");
const cleanupDevSource = readIfExists("scripts/cleanup-dev.sh");
const releaseWorkflowSource = read(
  ".github/workflows/autossl-release-desktop.yml",
);
const readmeSource = read("README.md");
const releaseCheckSource = read("scripts/releaseCheck.js");

test("auto renew should not fall back to admin config storage for non-admin users", () => {
  assert.doesNotMatch(
    autoRenewSource,
    /config-admin/,
    "non-admin renewals should not probe admin config storage",
  );
});

test("login form should not ship with default credentials prefilled", () => {
  const loginFormInit =
    loginSource.match(/const loginForm = ref\(\{[\s\S]*?\}\)/)?.[0] || "";

  assert.match(
    loginSource,
    /const loginForm = ref\(\{\s*username:\s*(['"])\1,\s*password:\s*(['"])\2,?\s*\}\)/,
    "login form should initialize both username and password as empty strings",
  );
  assert.doesNotMatch(
    loginFormInit,
    /zzhi\.net@gmail\.com/,
    "login form should not prefill the legacy admin email",
  );
  assert.doesNotMatch(
    loginFormInit,
    /zhangzhi\.net/,
    "login form should not prefill the legacy admin password",
  );
});

test("database should not create or accept the legacy default admin password", () => {
  assert.doesNotMatch(
    dbSource,
    /\binitAdmin\s*\(/,
    "database should not initialize a default admin account",
  );
  assert.doesNotMatch(
    dbSource,
    /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+admin[\s\S]*zhangzhi\.net/i,
    "database should not insert the legacy default admin password",
  );
  assert.match(
    dbSource,
    /removeDefaultAdminAccount\(\)/,
    "database should clean up the old development default admin account",
  );
  assert.doesNotMatch(
    dbSource,
    /verifyAdmin\(username,\s*password\)/,
    "database should not expose a local admin password verifier",
  );
});

test("public docs should not advertise legacy default credentials", () => {
  assert.doesNotMatch(
    readmeSource,
    /默认登录信息/,
    "README should not publish default login credentials",
  );
  assert.doesNotMatch(
    readmeSource,
    /密码：`zhangzhi\.net`/,
    "README should not publish the legacy default password",
  );
});

test("database should write sensitive fields with versioned authenticated encryption", () => {
  assert.match(
    dbSource,
    /safeStorage/,
    "database encryption should use Electron safeStorage when available",
  );
  assert.match(
    dbSource,
    /ENCRYPTION_PREFIX\s*=\s*'v2'/,
    "new encrypted values should be versioned",
  );
  assert.match(
    dbSource,
    /createCipheriv\('aes-256-gcm'/,
    "fallback local encryption should use AES-GCM",
  );
  assert.match(
    dbSource,
    /getAuthTag\(\)/,
    "AES-GCM encryption should persist an auth tag",
  );
  assert.match(
    dbSource,
    /setAuthTag\(/,
    "AES-GCM decryption should verify the auth tag",
  );
  assert.match(
    dbSource,
    /LEGACY_ENCRYPTION_KEY/,
    "legacy CBC key should remain decrypt-only for old saved data",
  );
  assert.doesNotMatch(
    dbSource,
    /const ENCRYPTION_KEY/,
    "new writes should not use the old fixed machine-derived key name",
  );
});

test("macOS release path should build DMG without App Store signing prerequisites", () => {
  const pkg = JSON.parse(packageSource);
  assert.ok(
    pkg.build.mac.target.includes("dmg"),
    "macOS build should produce a DMG installer",
  );
  assert.match(
    packageSource,
    /"release:check:mac": "node scripts\/releaseCheck\.js --mac"/,
    "package should expose a macOS DMG release check script",
  );
  assert.match(
    packageSource,
    /"release:check:mac:signed": "node scripts\/releaseCheck\.js --mac-signed"/,
    "package should keep signed macOS checks optional",
  );
  assert.match(
    packageSource,
    /"electron:release:mac": "npm run release:check:mac && vite build && electron-builder --publish never --mac dmg zip"/,
    "macOS release script should build DMG/ZIP without requiring Apple signing secrets",
  );

  for (const envName of [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ]) {
    assert.match(
      releaseCheckSource,
      new RegExp(`requireEnv\\('${envName}'\\)`),
      `optional signed release check should require ${envName}`,
    );
  }

  for (const secretName of [
    "MACOS_CSC_LINK",
    "MACOS_CSC_KEY_PASSWORD",
    "APPLE_ID",
    "APPLE_APP_SPECIFIC_PASSWORD",
    "APPLE_TEAM_ID",
  ]) {
    assert.doesNotMatch(
      releaseWorkflowSource,
      new RegExp(secretName),
      `DMG release workflow should not require ${secretName}`,
    );
  }

  assert.match(
    releaseWorkflowSource,
    /npm run electron:release:mac/,
    "release workflow should build macOS DMG bundles",
  );
  assert.match(
    releaseWorkflowSource,
    /macOS DMG installer/,
    "release notes should label the macOS artifact as a DMG installer",
  );
  assert.doesNotMatch(
    releaseWorkflowSource,
    /signed and notarized/,
    "DMG release workflow should not claim Apple notarization",
  );
});

test("macOS packaged app should carry main-process runtime dependencies", () => {
  const pkg = JSON.parse(packageSource);
  const afterPackSource = readIfExists("scripts/electronAfterPack.js");

  assert.equal(
    pkg.build.afterPack,
    "scripts/electronAfterPack.js",
    "electron-builder should copy runtime dependencies after packaging",
  );
  assert.match(
    afterPackSource,
    /npm[\s\S]*ls[\s\S]*--omit=dev[\s\S]*--parseable[\s\S]*--all/,
    "afterPack should derive the packaged node_modules from production dependencies",
  );
  assert.match(
    afterPackSource,
    /Resources['"],\s*'node_modules'|resourcesDir[\s\S]*node_modules/,
    "afterPack should place dependencies where app.asar module resolution can find them",
  );
  assert.match(
    afterPackSource,
    /better-sqlite3|production dependency/,
    "packaged app should avoid missing better-sqlite3 in the Electron main process",
  );
});

test("login should not hard-code a cloud email into the local admin tenant", () => {
  assert.doesNotMatch(
    loginSource,
    /isAdminEmail/,
    "login should not branch on a hard-coded admin email",
  );
  assert.doesNotMatch(
    loginSource,
    /云端管理员已登录/,
    "cloud login should not be presented as a local admin shortcut",
  );
  assert.doesNotMatch(
    loginSource,
    /email:\s*['"]zzhi\.net@gmail\.com['"]/,
    "login should not force a specific cloud email into the local admin session",
  );
});

test("cloud auth requests should be scoped to the AutoSSL app code", () => {
  assert.match(
    loginSource,
    /const APP_CODE = ["']certd-electron["']/,
    "login page should define the AutoSSL app code",
  );
  assert.match(
    loginSource,
    /response\?\.data\?\.data\s*\|\|\s*response\?\.data/,
    "login page should accept the production auth response envelope",
  );
  assert.match(
    loginSource,
    /auth\/send-code[\s\S]*appCode:\s*APP_CODE/,
    "send-code requests should include appCode",
  );
  assert.match(
    loginSource,
    /auth\/register[\s\S]*appCode:\s*APP_CODE/,
    "register requests should include appCode",
  );
  assert.match(
    loginSource,
    /auth\/login[\s\S]*appCode:\s*APP_CODE/,
    "login requests should include appCode",
  );
});

test("login page should support remote password reset by email code", () => {
  assert.match(
    loginSource,
    /忘记密码/,
    "login page should expose a forgot-password action",
  );
  assert.match(
    loginSource,
    /auth\/send-reset-code[\s\S]*appCode:\s*APP_CODE/,
    "reset-code requests should include appCode",
  );
  assert.match(
    loginSource,
    /auth\/reset-password[\s\S]*appCode:\s*APP_CODE/,
    "reset-password requests should include appCode",
  );
  assert.doesNotMatch(
    loginSource,
    /admin:login/,
    "password reset should stay on the remote auth flow",
  );
});

test("remote login should be the only app identity and should claim legacy local data", () => {
  assert.match(
    dbSource,
    /getLocalAdminDataSummary\(\)/,
    "database should expose a read-only local admin data summary",
  );
  assert.match(
    mainSource,
    /ipcMain\.handle\('user:get-local-data-summary'/,
    "main process should expose local data summary over IPC",
  );
  assert.match(
    preloadSource,
    /'user:get-local-data-summary'/,
    "preload should allow the local data summary IPC channel",
  );
  assert.doesNotMatch(
    loginSource,
    /recoverLocalSession|进入本地数据|本地管理员已验证/,
    "login page should not expose a separate local admin entry point",
  );
  assert.doesNotMatch(
    loginSource,
    /admin:login/,
    "login should authenticate through the remote account flow only",
  );
  assert.match(
    loginSource,
    /localStorage\.removeItem\(["']user["']\)[\s\S]*localStorage\.removeItem\(["']isLoggedIn["']\)/,
    "login page should clear stale local sessions before remote login",
  );
  assert.doesNotMatch(
    mainSource,
    /ipcMain\.handle\('admin:login'/,
    "main process should not expose a local admin login IPC",
  );
  assert.doesNotMatch(
    preloadSource,
    /'admin:login'/,
    "preload should not whitelist a local admin login IPC",
  );
  assert.match(
    mainSource,
    /ipcMain\.handle\('user:set-session'[\s\S]*certdDB\.claimLegacyData\(userId\)/,
    "main process should claim admin-owned legacy data for the active remote user",
  );
  for (const table of [
    "servers",
    "certificates",
    "cert_apply_configs",
    "cert_apply_logs",
    "deploy_logs",
    "audit_logs",
    "server_creation_logs",
  ]) {
    assert.match(
      dbSource,
      new RegExp(`UPDATE ${table} SET user_id = \\? WHERE user_id = 'admin'`),
      `legacy ${table} rows should move to the remote user id`,
    );
  }
  assert.doesNotMatch(
    loginSource,
    /检测到本机历史数据|登录后将自动合并到当前账号|local-recovery|user:get-local-data-summary|localDataSummary|hasRecoverableLocalData/,
    "login page should not show the local legacy data reminder card",
  );
  assert.match(
    loginSource,
    /auth\/check-email[\s\S]*账号未注册，请先申请开通[\s\S]*activeTab\.value = ["']register["']/,
    "login page should guide unregistered remote accounts into registration",
  );
});

test("dev startup should stop stale AutoSSL Electron main processes before launching", () => {
  const pkg = JSON.parse(packageSource);

  assert.match(
    pkg.scripts["electron:dev"],
    /bash scripts\/cleanup-dev\.sh && concurrently/,
    "npm run electron:dev should clean stale dev processes before launching",
  );
  assert.match(
    pkg.scripts.kill,
    /bash scripts\/cleanup-dev\.sh/,
    "npm run kill should reuse the scoped AutoSSL cleanup script",
  );
  assert.doesNotMatch(
    pkg.scripts.kill,
    /pkill -f electron\b/,
    "npm run kill should not use an unscoped Electron process match",
  );
  assert.match(
    startScriptSource,
    /bash "\$APP_DIR\/scripts\/cleanup-dev\.sh"/,
    "start.sh should use the shared dev cleanup script",
  );
  assert.match(
    cleanupDevSource,
    /node_modules\/electron\/dist\/Electron\.app\/Contents\/MacOS\/Electron/,
    "cleanup-dev.sh should stop the previous Electron main process for this app",
  );
  assert.match(
    cleanupDevSource,
    /node_modules\/\.bin\/electron/,
    "cleanup-dev.sh should also stop the npm electron wrapper for this app",
  );
});

test("ssh deployment logs should not expose private key or passphrase details", () => {
  const sensitiveLogPatterns = [
    /privateKeyPrefix/,
    /privateKeyLength/,
    /passphraseLength/,
    /Passphrase provided/,
    /Passphrase Status/,
    /Final Private Key Structure/,
    /Successfully read private key/,
    /Using Private Key from file path/,
    /Using Private Key from input/,
    /Header:/,
    /Footer:/,
  ];

  for (const pattern of sensitiveLogPatterns) {
    assert.doesNotMatch(
      sshSource,
      pattern,
      `ssh service should not log sensitive diagnostic field: ${pattern}`,
    );
    assert.doesNotMatch(
      mainSource,
      pattern,
      `main process should not log sensitive diagnostic field: ${pattern}`,
    );
  }
});

test("certificate delete and deployment lookups should stay user-scoped", () => {
  assert.match(
    dbSource,
    /deleteCert\(id,\s*userId\)/,
    "certificate deletion should accept a user id",
  );
  assert.match(
    dbSource,
    /getCertDeployedServers\(certId,\s*userId\)/,
    "deployment lookup should accept a user id",
  );
  assert.match(
    dbSource,
    /addCertServerDeployment\(certId,\s*serverId,\s*certPath,\s*keyPath,\s*passphrase,\s*userId\)/,
    "deployment inserts should accept a user id",
  );
  assert.match(
    dbSource,
    /removeCertServerDeployment\(certId,\s*serverId,\s*userId\)/,
    "deployment deletes should accept a user id",
  );

  assert.match(
    mainSource,
    /certdDB\.deleteCert\(id,\s*userId\)/,
    "IPC delete should pass the active user id",
  );
  assert.match(
    mainSource,
    /certdDB\.getCertDeployedServers\(certId,\s*userId\)/,
    "IPC deployed-server lookup should pass the active user id",
  );
  assert.match(
    mainSource,
    /certdDB\.addCertServerDeployment\(certId,\s*serverId,\s*certPath,\s*keyPath,\s*passphrase,\s*userId\)/,
    "IPC deployment insert should pass the active user id",
  );
  assert.match(
    mainSource,
    /certdDB\.removeCertServerDeployment\(certId,\s*serverId,\s*userId\)/,
    "IPC deployment delete should pass the active user id",
  );
});

test("certificate quota should be based on current certificates, and active certificates should not be deletable", () => {
  assert.match(
    mainSource,
    /const currentCertCount = certdDB\.getAllCerts\(userId\)\.length;/,
    "certificate quota checks should use the current certificate count",
  );

  assert.doesNotMatch(
    mainSource,
    /证书申请数量已达上限 \(包含历史记录\)/,
    "certificate quota errors should no longer mention historical application records",
  );

  assert.match(
    mainSource,
    /!cert\.expiresTime \|\| cert\.expiresTime > Date\.now\(\)/,
    "main process should block deletion of currently active certificates",
  );

  assert.match(
    mainSource,
    /生效中的证书不允许删除，只有已过期证书才可以删除/,
    "delete guard should explain that only expired certificates can be removed",
  );
});

test("license refresh should clear stale cache when cloud reports no active license", () => {
  assert.match(
    licenseSource,
    /No active license found|no active license/i,
    "license service should recognize the no-license response",
  );
  assert.match(
    licenseSource,
    /store\.delete\(STORE_KEY\)|clear.*STORE_KEY/i,
    "license service should clear cached license state",
  );
});

test("activation should return the frontend-compatible response shape", () => {
  assert.match(
    licenseSource,
    /return \{\s*valid:\s*false,\s*reason:/,
    "activation errors should expose reason for the UI",
  );
  assert.match(
    licenseSource,
    /return \{\s*valid:\s*true,\s*license:/,
    "activation success should expose valid/ license",
  );
});

test("scheduled auto renew should use the active user id", () => {
  assert.match(
    mainSource,
    /AutoRenewService\.init\(certdDB,\s*AcmeService,\s*SshService,\s*\(\)\s*=>\s*currentUser\?\.id/,
    "auto-renew init should receive a user-id resolver",
  );
  assert.match(
    autoRenewSource,
    /checkAndRenew\(getCurrentUserId\(\)\)/,
    "timer checks should run under the active user context",
  );
});

test("server and cert saves should reject ids owned by another user instead of reassigning ownership", () => {
  assert.match(
    dbSource,
    /getServerOwner\(id\)/,
    "db should expose server ownership lookups",
  );
  assert.match(
    dbSource,
    /getCertOwner\(id\)/,
    "db should expose cert ownership lookups",
  );
  assert.match(
    mainSource,
    /ownerUserId && ownerUserId !== userId/,
    "main process should block cross-user ownership reassignment",
  );
  assert.match(
    mainSource,
    /该服务器ID已被其他账户占用|服务器不存在或无权限访问/,
    "server save path should surface a clear ownership error",
  );
  assert.match(
    mainSource,
    /该证书ID已被其他账户占用|证书不存在或无权限访问/,
    "cert save path should surface a clear ownership error",
  );
});

test("remote session restore should claim admin legacy data into the remote local cache", () => {
  assert.match(
    mainSource,
    /ipcMain\.handle\('user:set-session'[\s\S]*claimLegacyData\(userId\)/,
    "restoring or logging in as a remote user should transfer legacy admin-owned local data",
  );
});

test("destructive password checks should verify the remote account, not local admin", () => {
  for (const [name, source] of [
    ["certificates", certificatesSource],
    ["servers", serversSource],
  ]) {
    assert.doesNotMatch(
      source,
      /admin:login/,
      `${name} delete confirmation should not use local admin password validation`,
    );
    assert.match(
      source,
      /axios\.post\(`\$\{API_BASE\}\/auth\/login`[\s\S]*appCode:\s*APP_CODE/,
      `${name} delete confirmation should validate the current remote account password`,
    );
    assert.match(
      source,
      /response\?\.data\?\.data \|\| response\?\.data/,
      `${name} delete confirmation should accept the production auth response envelope`,
    );
  }
});

test("offline license trust should be bounded by a seven day grace period", () => {
  assert.match(
    licenseSource,
    /OFFLINE_GRACE_DAYS\s*=\s*7|OFFLINE_GRACE_MS/,
    "license service should define an offline grace window",
  );
  assert.match(
    licenseSource,
    /lastVerified|last_verified/,
    "license service should track when online verification last succeeded",
  );
  assert.match(
    licenseSource,
    /offlineSince|offline_since/,
    "license service should track when offline mode started",
  );
  assert.match(
    licenseSource,
    /grace|7 \* 24 \* 60 \* 60 \* 1000/,
    "offline trust should be time-bounded rather than indefinite",
  );
});

test("preload whitelist should allow renderer channels that are actively used in the UI", () => {
  assert.match(
    preloadSource,
    /'dialog:open-file'/,
    "file picker channel should be whitelisted because Servers view uses it",
  );
  assert.match(
    preloadSource,
    /'cert:remove-deployment'/,
    "deployment removal channel should be whitelisted because Certificates view uses it",
  );
});

test("main process should not keep dead handlers with no implementation behind them", () => {
  assert.doesNotMatch(
    mainSource,
    /ipcMain\.handle\('server:get-certs'/,
    "unused server:get-certs handler should be removed until it has a real implementation",
  );
});

test("deployment paths should be absolute before they are stored or used", () => {
  assert.match(
    dbSource,
    /function validateRemoteDeploymentPath\(targetPath, label\)/,
    "database layer should define a remote deployment path validator",
  );

  assert.match(
    dbSource,
    /validateRemoteDeploymentPath\(certPath,\s*'SSL 公钥路径'\)/,
    "certificate deploy path should be validated before storing the deployment",
  );

  assert.match(
    dbSource,
    /validateRemoteDeploymentPath\(keyPath,\s*'SSL 私钥路径'\)/,
    "private key deploy path should be validated before storing the deployment",
  );
});

const handlerSlice = (channel) => {
  const start = mainSource.indexOf(`ipcMain.handle('${channel}'`);
  if (start < 0) return "";
  const end = mainSource.indexOf("ipcMain.handle(", start + 1);
  return end > start ? mainSource.slice(start, end) : mainSource.slice(start);
};

test("certificate list should fail loudly instead of falling back to a default user", () => {
  const getListSlice = handlerSlice("cert:get-all");

  assert.notEqual(
    getListSlice,
    "",
    "main process should register the cert:get-all handler",
  );

  assert.doesNotMatch(
    getListSlice,
    /\|\|\s*['"]default['"]/,
    "cert:get-all must not silently fall back to a default user id",
  );

  assert.match(
    getListSlice,
    /if \(!userId\) \{[\s\S]*throw new Error\(/,
    "cert:get-all should surface an explicit error when the session is not ready",
  );

  assert.match(
    getListSlice,
    /certdDB\.getAllCerts\(userId\)/,
    "cert:get-all should query with the active user id",
  );
});

test("certificate list query should require an explicit user id", () => {
  const getAllCertsSlice = dbSource.slice(
    dbSource.indexOf("getAllCerts(userId)"),
    dbSource.indexOf("normalizeDuplicateCerts(userId)"),
  );

  assert.match(
    getAllCertsSlice,
    /if \(!userId\) \{[\s\S]*throw new Error\(/,
    "getAllCerts should reject a missing user id instead of defaulting to admin",
  );

  assert.match(
    getAllCertsSlice,
    /const effectiveUserId = userId\b/,
    "getAllCerts should query with the explicit user id",
  );
});

test("certificate deployment editing should stay user scoped and reuse the upsert path", () => {
  const updateSlice = handlerSlice("cert:update-deployment");

  assert.notEqual(
    updateSlice,
    "",
    "main process should register the cert:update-deployment handler",
  );

  assert.match(
    updateSlice,
    /const userId = activeUserId\(\)/,
    "deployment editing should resolve the active user id",
  );

  assert.match(
    updateSlice,
    /if \(!userId\) \{[\s\S]*success: false/,
    "deployment editing should refuse to run without a ready session",
  );

  assert.match(
    updateSlice,
    /certdDB\.updateCertDeployment\(certId,\s*serverId,\s*certPath,\s*keyPath,\s*passphrase,\s*userId\)/,
    "deployment editing should pass the active user id into the database layer",
  );

  assert.match(
    preloadSource,
    /'cert:update-deployment'/,
    "preload whitelist should allow the deployment edit channel",
  );

  assert.match(
    dbSource,
    /INSERT OR REPLACE INTO cert_server_deployments/,
    "deployment editing should reuse the existing upsert insert",
  );

  assert.match(
    dbSource,
    /UPDATE certificates\s*SET server_id = \?, updated_at = CURRENT_TIMESTAMP\s*WHERE id = \? AND user_id = \? AND \(server_id IS NULL OR server_id = ''\)/,
    "deployment editing should only backfill server_id when it is empty and stay user scoped",
  );

  assert.match(
    certificatesSource,
    /@click="handleEditCert\(record\)"/,
    "certificate page should expose an edit action on each row",
  );

  assert.match(
    certificatesSource,
    /ipcRenderer\.invoke\(\s*'cert:update-deployment'/,
    "certificate page should submit edits through the edit channel",
  );
});

const { EventEmitter } = require("node:events");
const SshService = require("../electron/services/ssh-service.js");

const NGINX_DUMP = [
  "http {",
  "    server {",
  "        server_name 29do.com;",
  "        ssl_certificate /etc/nginx/ssl/29do.com/29do.com.pem;",
  "        ssl_certificate_key /etc/nginx/ssl/29do.com/29do.com.key;",
  "    }",
  "    server {",
  "        server_name www.yijiebuyi.com;",
  "        ssl_certificate      /etc/nginx/ssl/blog/www.yijiebuyi.com.pem;",
  "        ssl_certificate_key  /etc/nginx/ssl/blog/www.yijiebuyi.com.key;",
  "    }",
  "}",
].join("\n");

const REFERENCED_CANONICAL =
  "/etc/nginx/ssl/29do.com/29do.com.pem\n/etc/nginx/ssl/blog/www.yijiebuyi.com.pem\n";

const recordingConn = (handler) => {
  const calls = [];

  return {
    calls,
    exec(command, cb) {
      calls.push(command);
      const stream = new EventEmitter();
      stream.stderr = new EventEmitter();
      cb(null, stream);
      setImmediate(() => {
        const { output = "", code = 0 } = handler(command) || {};
        if (output) stream.emit("data", Buffer.from(output));
        stream.emit("close", code, null);
      });
    },
  };
};

const nginxServer = { reloadCommand: "sudo nginx -s reload" };

test("deploy warning should fire when nginx loads a different cert file than the one written", async () => {
  const conn = recordingConn((command) => {
    if (command.startsWith("sudo nginx -T")) return { output: NGINX_DUMP };
    if (command === "readlink -f '/etc/nginx/ssl/blog/public.pem'") {
      return { output: "/etc/nginx/ssl/blog/public.pem\n" };
    }
    if (command.startsWith("readlink -f")) return { output: REFERENCED_CANONICAL };
    return {};
  });

  const warning = await SshService.detectUnreferencedNginxCertPath(
    conn,
    nginxServer,
    "/etc/nginx/ssl/blog/public.pem",
  );

  assert.match(
    warning,
    /ssl_certificate/,
    "writing to a path nginx never references should warn instead of reporting a clean success",
  );
});

test("deploy warning should stay silent when nginx reaches the written path through a symlink", async () => {
  const conn = recordingConn((command) => {
    if (command.startsWith("sudo nginx -T")) return { output: NGINX_DUMP };
    if (command === "readlink -f '/etc/nginx/ssl/blog/www.yijiebuyi.com.pem'") {
      return { output: "/etc/nginx/ssl/blog/www.yijiebuyi.com.pem\n" };
    }
    if (command.startsWith("readlink -f")) return { output: REFERENCED_CANONICAL };
    return {};
  });

  const warning = await SshService.detectUnreferencedNginxCertPath(
    conn,
    nginxServer,
    "/etc/nginx/ssl/blog/www.yijiebuyi.com.pem",
  );

  assert.equal(
    warning,
    "",
    "a path nginx actually loads must never be flagged, even when nginx names a symlink to it",
  );
});

test("deploy warning should skip non-nginx servers and fail open when the probe is unavailable", async () => {
  const apacheConn = recordingConn(() => ({}));
  const apacheWarning = await SshService.detectUnreferencedNginxCertPath(
    apacheConn,
    { reloadCommand: "systemctl reload apache2" },
    "/etc/httpd/conf/server.pem",
  );

  assert.equal(apacheWarning, "", "non-nginx targets should not be warned about");
  assert.equal(apacheConn.calls.length, 0, "non-nginx targets should not be probed at all");

  const unreachableConn = recordingConn(() => ({ output: "", code: 1 }));
  const unreachableWarning = await SshService.detectUnreferencedNginxCertPath(
    unreachableConn,
    nginxServer,
    "/etc/nginx/ssl/blog/public.pem",
  );

  assert.equal(
    unreachableWarning,
    "",
    "a failing nginx -T probe must not warn or fail an otherwise successful deploy",
  );
});

test("deploy logging should share one message builder so neither path loses the warning", () => {
  assert.match(
    mainSource,
    /const deployedMessage = SshService\.buildDeployMessage\(server\.name, result\)/,
    "manual deploy should build its log message with the shared builder",
  );

  assert.match(
    autoRenewSource,
    /const deployedMessage = SshService\.buildDeployMessage\(server\.name, result\)/,
    "auto renew should build its log message with the shared builder",
  );

  assert.match(
    autoRenewSource,
    /message:\s*deployedMessage\b/,
    "auto renew should log the real deploy outcome instead of a hardcoded success string",
  );

  assert.doesNotMatch(
    autoRenewSource,
    /message:\s*['"]自动续期部署成功['"]/,
    "auto renew should no longer hardcode an unqualified success message",
  );

  assert.match(
    sshSource,
    /deployedPaths\.warning = /,
    "the deploy flow should attach the warning to the deployed paths",
  );

  assert.equal(
    SshService.buildDeployMessage("fogomo", {}).includes("警告"),
    false,
    "a clean deploy should not mention warnings",
  );

  assert.match(
    SshService.buildDeployMessage("fogomo", {
      paths: { certPath: "/a/b.pem", warning: "nginx 未引用该路径" },
    }),
    /警告: nginx 未引用该路径/,
    "the warning should reach the message the UI and deploy log render",
  );
});

console.log("reviewFixes.test.js passed");

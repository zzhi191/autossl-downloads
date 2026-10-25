const fs = require('fs/promises')
const path = require('path')

module.exports = async function beforeBuild(context) {
  const appDir = context.appDir || process.cwd()
  const optionalCpuFeaturesPath = path.join(appDir, 'node_modules', 'cpu-features')

  // ssh2 loads cpu-features inside try/catch. The optional native addon does not
  // compile against current Electron/V8, so leave ssh2 on its JS fallback path.
  await fs.rm(optionalCpuFeaturesPath, { recursive: true, force: true })
}

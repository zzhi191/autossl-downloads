const fs = require('fs')
const { execFileSync } = require('child_process')

const mode = process.argv[2] || ''
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

function fail(message) {
  console.error(`Release check failed: ${message}`)
  process.exitCode = 1
}

function requireEnv(name) {
  if (!process.env[name]) fail(`missing required environment variable ${name}`)
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}

function runWarn(command, args) {
  try {
    execFileSync(command, args, { stdio: 'inherit' })
  } catch (error) {
    console.warn(`Warning: ${command} ${args.join(' ')} exited with code ${error.status}; continuing`)
  }
}

if (mode === '--mac-signed') {
  requireEnv('CSC_LINK')
  requireEnv('CSC_KEY_PASSWORD')
  requireEnv('APPLE_ID')
  requireEnv('APPLE_APP_SPECIFIC_PASSWORD')
  requireEnv('APPLE_TEAM_ID')
}

if (mode === '--mac-signed') {
  if (pkg.build?.mac?.hardenedRuntime !== true) {
    fail('build.mac.hardenedRuntime must be true for macOS release signing')
  }

  if (pkg.build?.mac?.gatekeeperAssess !== false) {
    fail('build.mac.gatekeeperAssess must be false so notarization runs before Gatekeeper assessment')
  }
}

if (process.exitCode) process.exit(process.exitCode)

runWarn('npm', ['audit', '--registry=https://registry.npmjs.org'])
runWarn('npm', ['audit', '--omit=dev', '--registry=https://registry.npmjs.org'])
console.log('Release check passed')

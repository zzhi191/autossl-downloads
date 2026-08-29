const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const indexHtml = fs.readFileSync(
  path.resolve(__dirname, '../index.html'),
  'utf8'
)

test('normalizeLicensePlans supports legacy and nested API payloads', async () => {
  const { normalizeLicensePlans } = await import(
    pathToFileURL(path.resolve(__dirname, '../src/utils/license-plans.mjs')).href
  )

  const planList = [
    { code: 'free', name: '免费版' },
    { code: 'pro', name: '专业版' },
    { code: 'deprecated_old', name: '旧版套餐' },
    { code: 'enterprise', name: '企业版' }
  ]

  assert.deepEqual(
    normalizeLicensePlans({ success: true, data: planList }).map((plan) => plan.code),
    ['pro', 'enterprise']
  )

  assert.deepEqual(
    normalizeLicensePlans({ data: { success: true, data: planList }, code: 200 }).map((plan) => plan.code),
    ['pro', 'enterprise']
  )

  assert.deepEqual(
    normalizeLicensePlans(planList).map((plan) => plan.code),
    ['pro', 'enterprise']
  )
})

test('normalizeLicensePlans falls back to empty array for malformed payloads', async () => {
  const { normalizeLicensePlans } = await import(
    pathToFileURL(path.resolve(__dirname, '../src/utils/license-plans.mjs')).href
  )

  assert.deepEqual(normalizeLicensePlans(null), [])
  assert.deepEqual(normalizeLicensePlans({ data: { success: true, data: {} } }), [])
})

test('unwrapLicenseApiResponse supports the server response envelope', async () => {
  const { unwrapLicenseApiResponse } = await import(
    pathToFileURL(path.resolve(__dirname, '../src/utils/license-plans.mjs')).href
  )

  const orderResponse = { success: true, data: { orderNo: 'LIZ-001' } }

  assert.deepEqual(
    unwrapLicenseApiResponse({ data: orderResponse, code: 200, msg: 'success' }),
    orderResponse
  )
  assert.equal(unwrapLicenseApiResponse(orderResponse), orderResponse)
})

test('renderer CSP should not include unsafe-eval', () => {
  assert.doesNotMatch(
    indexHtml,
    /unsafe-eval/,
    'Electron renderer CSP should avoid unsafe-eval to prevent the security warning'
  )
})

console.log('licensePlansResponse.test.js passed')

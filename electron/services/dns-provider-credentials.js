const STORE_KEY = 'dnsProviderCredentials'

function getProviderCredentials(store, provider, fallbackConfig = null) {
  if (!provider) return null

  // A certificate configuration is only persisted after a successful ACME
  // issuance, so prefer it over an unverified draft cache.
  if (
    fallbackConfig?.accessKeyId &&
    fallbackConfig?.accessKeySecret &&
    (fallbackConfig.type || fallbackConfig.provider) === provider
  ) {
    const result = {
      type: provider,
      accessKeyId: fallbackConfig.accessKeyId,
      accessKeySecret: fallbackConfig.accessKeySecret
    }
    saveProviderCredentials(store, result)
    return result
  }

  const credentials = store.get(STORE_KEY, {})
  const cachedConfig = credentials[provider]
  if (cachedConfig?.accessKeyId && cachedConfig?.accessKeySecret) {
    return {
      type: provider,
      accessKeyId: cachedConfig.accessKeyId,
      accessKeySecret: cachedConfig.accessKeySecret
    }
  }

  return null
}

function saveProviderCredentials(store, profile) {
  const { type, accessKeyId, accessKeySecret } = profile || {}
  if (!type || !accessKeyId || !accessKeySecret) return false

  const credentials = store.get(STORE_KEY, {})
  store.set(STORE_KEY, {
    ...credentials,
    [type]: { accessKeyId, accessKeySecret }
  })
  return true
}

module.exports = {
  getProviderCredentials,
  saveProviderCredentials
}

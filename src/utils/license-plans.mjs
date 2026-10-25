const isPlanList = (value) => Array.isArray(value)

const pickPlanList = (payload) => {
  if (isPlanList(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  if (isPlanList(payload.data)) return payload.data

  if (payload.data && typeof payload.data === 'object' && isPlanList(payload.data.data)) {
    return payload.data.data
  }

  return []
}

export const normalizeLicensePlans = (payload) => {
  return pickPlanList(payload).filter((plan) => {
    if (!plan || typeof plan !== 'object') return false
    if (plan.code === 'free') return false
    if (typeof plan.code === 'string' && plan.code.startsWith('deprecated_')) return false
    return true
  })
}

export const unwrapLicenseApiResponse = (payload) => {
  if (
    payload &&
    typeof payload === 'object' &&
    payload.data &&
    typeof payload.data === 'object' &&
    !Array.isArray(payload.data) &&
    ('code' in payload || 'msg' in payload)
  ) {
    return payload.data
  }

  return payload
}

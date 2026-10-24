function normalizeLicenseResponse(payload) {
  let current = payload;

  for (let i = 0; i < 3; i += 1) {
    if (!current || typeof current !== 'object') {
      return current;
    }

    if (typeof current.code !== 'undefined' && current.data) {
      current = current.data;
      continue;
    }

    return current;
  }

  return current;
}

module.exports = normalizeLicenseResponse;

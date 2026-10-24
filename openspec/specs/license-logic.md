# License Display & Multi-Plan Support

## Background
The application has transitioned from a single "Professional" (pro) plan system to a multi-plan system (e.g., cert-2, cert-5, cert-10). The previous logic often hardcoded checks for `plan === 'pro'`, which caused UI flickering to "Free" for users on new professional plans.

## Enforcement Rules

### 1. Unified Authorization Check
**NEVER** use `license.plan === 'pro'` to check for professional status.
**ALWAYS** use a "Not Free" check:
```javascript
const isPro = license && license.plan && license.plan !== 'free';
```

### 2. Display Name Priority
The displayed plan name should follow this hierarchy:
1.  **Backend explicitly provided name**: Use `license.plan_name` if available.
2.  **Fallback to generic "Professional"**: If `plan` is not 'free', show "专业版".
3.  **Default to "Free"**: Only show "免费版" if the `plan` is explicitly 'free' or missing.

Example implementation in Vue:
```javascript
const planName = computed(() => {
  if (!license.value) return '验证中...'
  if (license.value.plan_name) return license.value.plan_name
  if (license.value.plan && license.value.plan !== 'free') return '专业版'
  return '免费版'
})
```

### 3. Icon and Styling
- Show the **Crown icon** and **Gold theme** for any plan that is NOT 'free'.
- Do not limit premium styling to only the 'pro' or 'lifetime' strings.

### 4. Multi-Plan Code Compatibility (V5/V10/V20)
- **Plan Codes**: The system now uses codes like `cert-2`, `cert-5`, `cert-10`, `cert-20`.
- **Logic Mapping**: 
    - `plan === 'free'` -> 免费版 (Basic/Free)
    - `plan !== 'free'` -> 专业版 (Professional/Pro)
- **Automatic Recognition**: All services (Auto-Renew, Deployment, Statistics) MUST treat any non-free code as having full professional privileges, subject only to `constraints` limits.

- **STRICT ENFORCEMENT**: Regression to `plan === 'pro'` checks is considered a **CRITICAL BUG**. Any automated or manual edits found doing this must be reverted immediately.
- **2026-02-02 Resolution**: Completed a full project audit. Replaced all occurrences of strict `pro` string matching with inclusive `!== 'free'` logic in both Electron main process and Vue renderer.

---

## Security & Stability (v2026.02)

### 1. Security Hardening (Anti-Hijacking)
To prevent MITM or domain hijacking attacks:
- **Hardcoded Public Key**: The `license-service.js` MUST contain the RSA Public Key as a hardcoded string constant. NEVER load it from an external file (`.pem`).
- **Strict Verification**: If `verifySignature` fails or the public key is missing, the client MUST reject the license (Fail Secure). Do NOT fallback to 'true'.

### 2. Machine ID Stability (Persistent ID)
To solve ID drifting issues (especially on macOS non-root or VM environments), the `Machine ID` generation MUST follow this priority:
1.  **Level 1 (Native)**: Try `machineIdSync({ original: true })`.
2.  **Level 2 (Persistent File)**: If Level 1 fails, check/read/write to `~/.certd_device_id`.
3.  **Level 3 (Random Fallback)**: Generate a random UUID and persist it to the file above.

**Invariant**: Once an ID is written to `~/.certd_device_id`, the client MUST priority use it to ensure the Machine ID remains constant across reboots/updates.

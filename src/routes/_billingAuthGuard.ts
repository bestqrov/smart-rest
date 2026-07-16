// Shared SuperAdmin guard for the billing route files added in K5/K7/K8/K9
// (billingMetricsSA, billingSettingsSA, billingAuditSA, usageLimitsSA).
// Consolidates what was previously copy-pasted identically in each of them.

export function requireSuperAdmin(req: any, res: any): boolean {
  if (req.headers['x-superadmin-secret'] !== process.env.SUPERADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  if (!req.headers['x-superadmin-email']) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

export function saEmail(req: any): string {
  return String(req.headers['x-superadmin-email'] ?? 'sa@system')
}

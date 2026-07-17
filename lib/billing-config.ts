function boundedDays(
  value: string | undefined,
  fallback: number,
  maximum: number
): number {
  const configured = Number.parseInt(value ?? String(fallback), 10);
  return Number.isFinite(configured)
    ? Math.min(maximum, Math.max(1, configured))
    : fallback;
}

export function configuredConsignmentTrialDays(): number {
  return boundedDays(process.env.CONSIGNMENT_ADDON_TRIAL_DAYS, 14, 60);
}

export function configuredConsignmentGraceDays(): number {
  return boundedDays(process.env.CONSIGNMENT_ADDON_GRACE_DAYS, 7, 30);
}

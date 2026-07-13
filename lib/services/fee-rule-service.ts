import type { ItemCondition } from "@/lib/services/condition-service";

export interface FeeRuleCandidate {
  id: string;
  organizationId: string;
  platformId: string;
  marketplaceAccountId: string | null;
  category: string | null;
  itemCondition: ItemCondition | null;
  validFrom: Date;
  validUntil: Date | null;
  priority: number;
  active: boolean;
}

export interface FeeRuleContext {
  organizationId: string;
  platformId: string;
  marketplaceAccountId?: string | null;
  category?: string | null;
  itemCondition?: ItemCondition | null;
  at?: Date;
}

function sameOptionalText(ruleValue: string | null, contextValue?: string | null): boolean {
  if (ruleValue === null) return true;
  if (!contextValue) return false;
  return ruleValue.localeCompare(contextValue, undefined, { sensitivity: "accent" }) === 0;
}

export function isFeeRuleEffective(
  rule: FeeRuleCandidate,
  context: FeeRuleContext
): boolean {
  const at = context.at ?? new Date();
  return (
    rule.active &&
    rule.organizationId === context.organizationId &&
    rule.platformId === context.platformId &&
    rule.validFrom.getTime() <= at.getTime() &&
    (rule.validUntil === null || rule.validUntil.getTime() > at.getTime()) &&
    (rule.marketplaceAccountId === null ||
      rule.marketplaceAccountId === context.marketplaceAccountId) &&
    sameOptionalText(rule.category, context.category) &&
    (rule.itemCondition === null || rule.itemCondition === context.itemCondition)
  );
}

function specificity(rule: FeeRuleCandidate): number {
  return Number(rule.marketplaceAccountId !== null) +
    Number(rule.category !== null) +
    Number(rule.itemCondition !== null);
}

export function selectEffectiveFeeRule<T extends FeeRuleCandidate>(
  rules: readonly T[],
  context: FeeRuleContext
): T | null {
  return (
    rules
      .filter((rule) => isFeeRuleEffective(rule, context))
      .sort(
        (left, right) =>
          right.priority - left.priority ||
          specificity(right) - specificity(left) ||
          right.validFrom.getTime() - left.validFrom.getTime() ||
          left.id.localeCompare(right.id)
      )[0] ?? null
  );
}

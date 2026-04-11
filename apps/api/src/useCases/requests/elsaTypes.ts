export const ElsaResponseMode = {
  NEED_MORE_INFO: 'NEED_MORE_INFO',
  SAFE_BASIC_TROUBLESHOOTING: 'SAFE_BASIC_TROUBLESHOOTING',
  ESCALATE_TO_VENDOR: 'ESCALATE_TO_VENDOR',
  EMERGENCY_ESCALATION: 'EMERGENCY_ESCALATION',
  DUPLICATE_OR_ALREADY_IN_PROGRESS: 'DUPLICATE_OR_ALREADY_IN_PROGRESS',
} as const;

export const ElsaDeliveryDecision = {
  AUTO_SEND_ALLOWED: 'AUTO_SEND_ALLOWED',
  ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED',
} as const;

export const ElsaPolicyDecision = {
  SEND_AUTOMATICALLY: 'SEND_AUTOMATICALLY',
  HOLD_FOR_REVIEW: 'HOLD_FOR_REVIEW',
  BLOCK_AND_ALERT_ADMIN: 'BLOCK_AND_ALERT_ADMIN',
} as const;

export type ElsaResponseMode = typeof ElsaResponseMode[keyof typeof ElsaResponseMode];
export type ElsaDeliveryDecision = typeof ElsaDeliveryDecision[keyof typeof ElsaDeliveryDecision];
export type ElsaPolicyDecision = typeof ElsaPolicyDecision[keyof typeof ElsaPolicyDecision];

export type ElsaSuggestion = {
  mode: ElsaResponseMode;
  deliveryDecision: ElsaDeliveryDecision;
  tenantReplyDraft: string;
  internalSummary: string;
  recommendedNextAction: string;
  missingInformation: string[];
  safeTroubleshootingSteps: string[];
  dispatchSummary: string;
  confidence: number;
  policyFlags: string[];
  autoSendRationale: string;
};

export type ElsaPolicyEvaluation = {
  policyDecision: ElsaPolicyDecision;
  policyFlags: string[];
  reasons: string[];
  templateFamily:
    | 'ACKNOWLEDGMENT'
    | 'NEED_MORE_INFO'
    | 'SAFE_BASIC_TROUBLESHOOTING'
    | 'DUPLICATE_OR_ALREADY_IN_PROGRESS'
    | 'EMERGENCY_FIXED';
};

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseElsaSuggestion(raw: unknown): ElsaSuggestion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const mode = String(row.mode ?? '');
  const deliveryDecision = String(row.deliveryDecision ?? '');
  const confidence = Number(row.confidence);

  const modeAllowed = Object.values(ElsaResponseMode).includes(mode as ElsaResponseMode);
  const deliveryAllowed = Object.values(ElsaDeliveryDecision).includes(
    deliveryDecision as ElsaDeliveryDecision
  );
  if (!modeAllowed || !deliveryAllowed) return null;
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  if (typeof row.tenantReplyDraft !== 'string') return null;
  if (typeof row.internalSummary !== 'string') return null;
  if (typeof row.recommendedNextAction !== 'string') return null;
  if (typeof row.dispatchSummary !== 'string') return null;
  if (typeof row.autoSendRationale !== 'string') return null;
  if (!isArrayOfStrings(row.missingInformation)) return null;
  if (!isArrayOfStrings(row.safeTroubleshootingSteps)) return null;
  if (!isArrayOfStrings(row.policyFlags)) return null;

  return {
    mode: mode as ElsaResponseMode,
    deliveryDecision: deliveryDecision as ElsaDeliveryDecision,
    tenantReplyDraft: row.tenantReplyDraft,
    internalSummary: row.internalSummary.trim(),
    recommendedNextAction: row.recommendedNextAction.trim(),
    missingInformation: row.missingInformation.map((item) => item.trim()).filter(Boolean),
    safeTroubleshootingSteps: row.safeTroubleshootingSteps.map((item) => item.trim()).filter(Boolean),
    dispatchSummary: row.dispatchSummary.trim(),
    confidence,
    policyFlags: row.policyFlags.map((item) => item.trim()).filter(Boolean),
    autoSendRationale: row.autoSendRationale.trim(),
  };
}

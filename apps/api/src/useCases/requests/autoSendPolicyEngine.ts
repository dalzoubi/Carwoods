import type { RequestRow } from '../../lib/requestsRepo.js';
import type { ElsaSettings } from '../../lib/elsaRepo.js';
import {
  ElsaPolicyDecision,
  ElsaResponseMode,
  type ElsaPolicyDecision as ElsaPolicyDecisionType,
  type ElsaPolicyEvaluation,
  type ElsaSuggestion,
} from './elsaTypes.js';

export type AutoSendPolicyContext = {
  request: RequestRow;
  settings: ElsaSettings;
  requestAutoRespondEnabled: boolean;
  categoryAutoSendEnabled: boolean;
  priorityAutoSendEnabled: boolean;
  priorityRequiresReview: boolean;
  propertyAutoSendEnabledOverride: boolean | null;
  propertyRequireReviewAll: boolean;
  allowlistCodes: string[];
  hasScheduledWindow: boolean;
};

const BLOCKED_PHRASES = [
  /we accept liability/i,
  /we are liable/i,
  /we will reimburse/i,
  /lawsuit/i,
  /attorney/i,
  /legal action/i,
];

const SCHEDULING_PROMISES = [
  /we will arrive/i,
  /we will be there/i,
  /scheduled for/i,
  /appointment is/i,
  /we confirm your appointment/i,
];

const EMERGENCY_FLAGS = [
  'EMERGENCY_SIGNAL_GAS',
  'EMERGENCY_SIGNAL_SMOKE',
  'EMERGENCY_SIGNAL_SPARKING',
  'EMERGENCY_SIGNAL_FLOOD',
  'EMERGENCY_SIGNAL_SEWAGE',
  'EMERGENCY_SIGNAL_CO',
];

function inferTemplateFamily(mode: string): ElsaPolicyEvaluation['templateFamily'] {
  if (mode === ElsaResponseMode.NEED_MORE_INFO) return 'NEED_MORE_INFO';
  if (mode === ElsaResponseMode.SAFE_BASIC_TROUBLESHOOTING) return 'SAFE_BASIC_TROUBLESHOOTING';
  if (mode === ElsaResponseMode.DUPLICATE_OR_ALREADY_IN_PROGRESS) return 'DUPLICATE_OR_ALREADY_IN_PROGRESS';
  if (mode === ElsaResponseMode.EMERGENCY_ESCALATION) return 'EMERGENCY_FIXED';
  return 'ACKNOWLEDGMENT';
}

function normalizeText(v: string): string {
  return String(v || '').trim().toLowerCase();
}

export function evaluatePolicy(
  context: AutoSendPolicyContext,
  suggestion: ElsaSuggestion
): ElsaPolicyEvaluation {
  const policyFlags = new Set<string>(suggestion.policyFlags ?? []);
  const reasons: string[] = [];
  const text = suggestion.tenantReplyDraft || '';
  const maxChars = 1200;
  const maxQuestions = Number(context.settings.elsa_max_questions || 5);
  const maxSteps = Number(context.settings.elsa_max_steps || 5);

  const emergencyHit =
    EMERGENCY_FLAGS.some((flag) => policyFlags.has(flag))
    || context.settings.elsa_emergency_keywords.some((keyword) => normalizeText(text).includes(normalizeText(keyword)));
  if (emergencyHit) {
    policyFlags.add('POLICY_EMERGENCY_DETECTED');
    reasons.push('Emergency signal detected');
  }

  if (!context.settings.elsa_enabled) {
    policyFlags.add('FEATURE_DISABLED');
    reasons.push('Elsa disabled globally');
  }
  if (!context.settings.elsa_auto_send_enabled) {
    policyFlags.add('AUTO_SEND_DISABLED_GLOBAL');
    reasons.push('Auto-send disabled globally');
  }
  if (!context.requestAutoRespondEnabled) {
    policyFlags.add('REQUEST_LEVEL_AUTO_RESPOND_DISABLED');
    reasons.push('Request-level auto respond disabled');
  }
  if (!context.categoryAutoSendEnabled) {
    policyFlags.add('CATEGORY_NOT_ALLOWED');
    reasons.push('Category is disabled for auto-send');
  }
  if (!context.priorityAutoSendEnabled) {
    policyFlags.add('PRIORITY_NOT_ALLOWED');
    reasons.push('Priority is disabled for auto-send');
  }
  if (context.priorityRequiresReview) {
    policyFlags.add('PRIORITY_REVIEW_REQUIRED');
    reasons.push('Priority requires admin review');
  }
  if (context.propertyRequireReviewAll) {
    policyFlags.add('PROPERTY_REVIEW_REQUIRED');
    reasons.push('Property policy requires review');
  }
  if (context.propertyAutoSendEnabledOverride === false) {
    policyFlags.add('PROPERTY_AUTO_SEND_DISABLED');
    reasons.push('Property override disables auto-send');
  }

  if (suggestion.confidence < Number(context.settings.elsa_auto_send_confidence_threshold || 0.78)) {
    policyFlags.add('LOW_CONFIDENCE');
    reasons.push('Confidence below threshold');
  }

  if (text.length > maxChars) {
    policyFlags.add('MESSAGE_TOO_LONG');
    reasons.push('Tenant draft exceeds max length');
  }
  if ((text.match(/\?/g) ?? []).length > maxQuestions) {
    policyFlags.add('TOO_MANY_QUESTIONS');
    reasons.push('Too many questions for auto-send');
  }
  if ((suggestion.safeTroubleshootingSteps ?? []).length > maxSteps) {
    policyFlags.add('TOO_MANY_TROUBLESHOOTING_STEPS');
    reasons.push('Too many troubleshooting steps');
  }

  for (const regex of BLOCKED_PHRASES) {
    if (regex.test(text)) {
      policyFlags.add('BLOCKED_TOPIC_LIABILITY');
      reasons.push('Liability/legal language detected');
      break;
    }
  }
  if (
    context.settings.elsa_blocked_keywords.some((keyword) => normalizeText(text).includes(normalizeText(keyword)))
  ) {
    policyFlags.add('BLOCKED_KEYWORD_MATCH');
    reasons.push('Blocked keyword detected');
  }

  if (!context.hasScheduledWindow && SCHEDULING_PROMISES.some((regex) => regex.test(text))) {
    policyFlags.add('UNSUPPORTED_SCHEDULING_PROMISE');
    reasons.push('Scheduling promise missing backend schedule evidence');
  }

  const allowlist = new Set(context.allowlistCodes);
  const missingAllowlist = (suggestion.policyFlags ?? [])
    .filter((flag) => flag.startsWith('SAFE_TROUBLESHOOTING_ALLOWLIST:'))
    .map((flag) => flag.split(':')[1])
    .filter((code) => code && !allowlist.has(code));
  if (missingAllowlist.length > 0) {
    policyFlags.add('ALLOWLIST_MISMATCH');
    reasons.push(`Unsupported troubleshooting steps: ${missingAllowlist.join(', ')}`);
  }

  const templateFamily = inferTemplateFamily(suggestion.mode);
  let policyDecision: ElsaPolicyDecisionType = ElsaPolicyDecision.SEND_AUTOMATICALLY;

  if (emergencyHit) {
    policyDecision = ElsaPolicyDecision.BLOCK_AND_ALERT_ADMIN;
  } else if (
    reasons.length > 0
    || !Object.values(ElsaResponseMode).includes(suggestion.mode)
  ) {
    policyDecision = ElsaPolicyDecision.HOLD_FOR_REVIEW;
  }
  return {
    policyDecision,
    policyFlags: Array.from(policyFlags),
    reasons,
    templateFamily,
  };
}

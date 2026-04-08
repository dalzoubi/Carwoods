import {
  ElsaResponseMode,
  type ElsaPolicyEvaluation,
  type ElsaSuggestion,
} from './elsaTypes.js';

function trimLine(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function fixedEmergencyTemplate(): string {
  return 'If there is a gas odor, smoke, fire, active sparking, or immediate danger, prioritize your safety first and call 911 or the utility emergency line as appropriate. Please leave the area if unsafe. We are flagging this as urgent.';
}

export function normalizeTenantReply(
  suggestion: ElsaSuggestion,
  evaluation: ElsaPolicyEvaluation
): string {
  if (evaluation.templateFamily === 'EMERGENCY_FIXED') {
    return fixedEmergencyTemplate();
  }

  if (evaluation.templateFamily === 'DUPLICATE_OR_ALREADY_IN_PROGRESS') {
    return trimLine(
      'Thanks for your update. This request is already being handled. If anything materially changed, please share the new details and photos.'
    );
  }

  if (evaluation.templateFamily === 'SAFE_BASIC_TROUBLESHOOTING') {
    const steps = (suggestion.safeTroubleshootingSteps ?? []).slice(0, 5).map((item) => `- ${trimLine(item)}`);
    const intro = 'Thanks for reporting this. While we review, please try these safe checks:';
    return [intro, ...steps].join('\n');
  }

  if (evaluation.templateFamily === 'NEED_MORE_INFO') {
    const info = (suggestion.missingInformation ?? []).slice(0, 5).map((item) => `- ${trimLine(item)}`);
    const intro = 'Thanks for reporting this. We are reviewing your request. Please share:';
    return [intro, ...info].join('\n');
  }

  if (suggestion.mode === ElsaResponseMode.ESCALATE_TO_VENDOR) {
    return trimLine(
      'Thanks for reporting this. We have received your request and our team will review next steps shortly.'
    );
  }

  return trimLine(
    suggestion.tenantReplyDraft
      || 'Thanks for reporting this. We received your request and will review it shortly.'
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../dist/src/useCases/requests/autoSendPolicyEngine.js';

const baseRequest = {
  id: 'req-1',
  property_id: 'prop-1',
  lease_id: 'lease-1',
  submitted_by_user_id: 'tenant-1',
  assigned_vendor_id: null,
  category_id: 'cat-id',
  category_code: 'hvac',
  category_name: 'HVAC',
  priority_id: 'pri-id',
  priority_code: 'routine',
  priority_name: 'Routine',
  current_status_id: 'status-id',
  status_code: 'NOT_STARTED',
  status_name: 'Not started',
  title: 'AC issue',
  description: 'AC not cooling',
  internal_notes: null,
  estimated_cost: null,
  actual_cost: null,
  scheduled_for: null,
  scheduled_from: null,
  scheduled_to: null,
  vendor_contact_name: null,
  vendor_contact_email: null,
  vendor_contact_phone: null,
  submitted_by_display_name: 'Tenant User',
  submitted_by_role: 'TENANT',
  submitted_by_first_name: 'Tenant',
  submitted_by_last_name: 'User',
  submitted_by_profile_photo_url: null,
  emergency_disclaimer_acknowledged: true,
  created_at: new Date(),
  updated_at: new Date(),
  completed_at: null,
  closed_at: null,
  deleted_at: null,
};

const baseSettings = {
  elsa_enabled: true,
  elsa_auto_send_enabled: true,
  elsa_auto_send_confidence_threshold: 0.78,
  elsa_allowed_categories: ['hvac', 'plumbing'],
  elsa_allowed_priorities: ['routine', 'urgent'],
  elsa_blocked_keywords: ['injury', 'liability'],
  elsa_emergency_keywords: ['gas smell', 'fire'],
  elsa_max_questions: 5,
  elsa_max_steps: 5,
  elsa_admin_alert_recipients: [],
  elsa_emergency_template_enabled: true,
};

const baseContext = {
  request: baseRequest,
  settings: baseSettings,
  requestAutoRespondEnabled: true,
  categoryAutoSendEnabled: true,
  priorityAutoSendEnabled: true,
  priorityRequiresReview: false,
  propertyAutoSendEnabledOverride: true,
  propertyRequireReviewAll: false,
  allowlistCodes: [
    'HVAC_CHECK_THERMOSTAT_MODE',
    'GENERAL_REQUEST_PHOTO',
  ],
  hasScheduledWindow: false,
};

const baseSuggestion = {
  mode: 'NEED_MORE_INFO',
  deliveryDecision: 'AUTO_SEND_ALLOWED',
  tenantReplyDraft: 'Thanks for reporting this. Please share a photo of the thermostat settings.',
  internalSummary: 'Need more info.',
  recommendedNextAction: 'Collect missing info.',
  missingInformation: ['Share a photo'],
  safeTroubleshootingSteps: [],
  dispatchSummary: '',
  confidence: 0.85,
  policyFlags: [],
  autoSendRationale: 'Low risk',
};

test('safe missing-info request can auto-send', () => {
  const result = evaluatePolicy(baseContext, baseSuggestion);
  assert.equal(result.policyDecision, 'SEND_AUTOMATICALLY');
});

test('emergency indicators block and alert admin', () => {
  const result = evaluatePolicy(baseContext, {
    ...baseSuggestion,
    mode: 'EMERGENCY_ESCALATION',
    policyFlags: ['EMERGENCY_SIGNAL_GAS'],
    tenantReplyDraft: 'Gas smell reported. Leave area now.',
  });
  assert.equal(result.policyDecision, 'BLOCK_AND_ALERT_ADMIN');
});

test('low confidence holds for review', () => {
  const result = evaluatePolicy(baseContext, {
    ...baseSuggestion,
    confidence: 0.5,
  });
  assert.equal(result.policyDecision, 'HOLD_FOR_REVIEW');
  assert.equal(result.policyFlags.includes('LOW_CONFIDENCE'), true);
});

test('liability language blocks auto-send path', () => {
  const result = evaluatePolicy(baseContext, {
    ...baseSuggestion,
    tenantReplyDraft: 'We accept liability and will reimburse your damages.',
  });
  assert.equal(result.policyDecision, 'HOLD_FOR_REVIEW');
  assert.equal(result.policyFlags.includes('BLOCKED_TOPIC_LIABILITY'), true);
});

test('scheduling promise without schedule context holds for review', () => {
  const result = evaluatePolicy(
    { ...baseContext, hasScheduledWindow: false },
    {
      ...baseSuggestion,
      tenantReplyDraft: 'We will arrive tomorrow at 9 AM.',
    }
  );
  assert.equal(result.policyDecision, 'HOLD_FOR_REVIEW');
  assert.equal(result.policyFlags.includes('UNSUPPORTED_SCHEDULING_PROMISE'), true);
});

test('allowlist mismatch holds troubleshooting auto-send', () => {
  const result = evaluatePolicy(baseContext, {
    ...baseSuggestion,
    mode: 'SAFE_BASIC_TROUBLESHOOTING',
    policyFlags: ['SAFE_TROUBLESHOOTING_ALLOWLIST:UNKNOWN_STEP'],
    safeTroubleshootingSteps: ['Do unknown repair'],
  });
  assert.equal(result.policyDecision, 'HOLD_FOR_REVIEW');
  assert.equal(result.policyFlags.includes('ALLOWLIST_MISMATCH'), true);
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '../../i18n';
import { WithAppTheme } from '../../testUtils';
import RequestDetailPane from './RequestDetailPane';

function makeProps(overrides = {}) {
  return {
    requestDetail: {
      id: 'req-1',
      title: 'Kitchen leak',
      description: 'Water under sink',
      status_code: 'NOT_STARTED',
      status_name: 'Not started',
      created_at: '2026-04-08T10:00:00Z',
      updated_at: '2026-04-08T10:00:00Z',
      category_name: 'Plumbing',
      priority_name: 'Routine',
      submitted_by_display_name: 'Tenant One',
      submitted_by_user_id: 'tenant-1',
      submitted_by_role: 'TENANT',
      scheduled_from: null,
      scheduled_for: null,
      scheduled_to: null,
      vendor_contact_name: null,
      vendor_contact_phone: null,
    },
    detailStatus: 'ok',
    detailError: '',
    isManagement: true,
    isAdmin: true,
    managementForm: {
      status_code: '',
      priority_code: '',
      scheduled_from: '',
      scheduled_to: '',
      assigned_vendor_id: '',
      vendor_contact_name: '',
      vendor_contact_phone: '',
      internal_notes: '',
    },
    managementStatusOptions: ['NOT_STARTED', 'WAITING_ON_VENDOR'],
    managementPriorityOptions: [
      { code: 'routine', name: 'Routine' },
      { code: 'urgent', name: 'Urgent' },
    ],
    onManagementField: () => () => {},
    onUpdateRequest: (event) => event?.preventDefault?.(),
    managementUpdateStatus: 'idle',
    managementUpdateError: '',
    threadMessages: [],
    messageForm: { body: '', is_internal: false },
    setMessageForm: () => {},
    onMessageSubmit: (event) => event?.preventDefault?.(),
    messageStatus: 'idle',
    messageError: '',
    messageDeleteStatus: 'idle',
    messageDeleteError: '',
    onDeleteMessage: async () => {},
    attachments: [],
    onAttachmentChange: () => {},
    onAttachmentSubmit: (event) => event?.preventDefault?.(),
    attachmentFile: null,
    attachmentStatus: 'idle',
    attachmentError: '',
    attachmentUploadProgress: 0,
    auditEvents: [],
    auditStatus: 'idle',
    auditError: '',
    elsaSettingsError: '',
    elsaDecisionStatus: 'idle',
    elsaDecisionError: '',
    elsaDecisionActionStatus: 'idle',
    elsaDecisions: [],
    elsaAutoRespondEnabled: true,
    onSetElsaAutoRespond: async () => {},
    onRunElsa: async () => {},
    onReviewElsaDecision: async () => {},
    onCancelRequest: async () => {},
    cancelStatus: 'idle',
    cancelError: '',
    ...overrides,
  };
}

describe('RequestDetailPane', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders simplified Elsa labels and hides technical chips', () => {
    const props = makeProps({
      elsaDecisions: [
        {
          id: 'decision-1',
          policy_decision: 'HOLD_FOR_REVIEW',
          mode: 'NEED_MORE_INFO',
          provider_used: 'remote',
          model_name: 'gemini-2.5-flash',
          confidence: 0.92,
          normalized_tenant_reply: 'Please share a photo so we can schedule service.',
          internal_summary: 'Need one more detail from tenant.',
          recommended_next_action: 'Ask for photo.',
          reviewed_at: null,
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('Needs more info')).toBeInTheDocument();
    expect(screen.getByText('High confidence')).toBeInTheDocument();
    expect(screen.getByText('Message to tenant: Please share a photo so we can schedule service.')).toBeInTheDocument();
    expect(screen.queryByText('Provider: remote')).not.toBeInTheDocument();
    expect(screen.queryByText('Model: gemini-2.5-flash')).not.toBeInTheDocument();
  });

  it('shows dismiss action for auto-sent Elsa decisions', () => {
    const props = makeProps({
      elsaDecisions: [
        {
          id: 'decision-auto-1',
          policy_decision: 'SEND_AUTOMATICALLY',
          mode: 'ESCALATE_TO_VENDOR',
          confidence: 0.84,
          normalized_tenant_reply: 'We have dispatched a vendor.',
          internal_summary: 'Vendor dispatch required.',
          recommended_next_action: 'Confirm visit window.',
          reviewed_at: null,
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('copies blocked AI message into compose form and asks for dismiss confirmation', () => {
    const setMessageForm = vi.fn();
    const props = makeProps({
      setMessageForm,
      elsaDecisions: [
        {
          id: 'decision-blocked-1',
          policy_decision: 'BLOCK_AND_ALERT_ADMIN',
          mode: 'EMERGENCY_ESCALATION',
          confidence: 0.91,
          normalized_tenant_reply: 'Please leave the area and call the gas utility immediately.',
          internal_summary: 'Potential gas outage and safety risk.',
          recommended_next_action: 'Contact gas utility and dispatch emergency vendor.',
          reviewed_at: null,
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use in message box' }));

    expect(setMessageForm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Suggested message copied' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss suggestion' })).toBeInTheDocument();
  });

  it('dismisses AI suggestion from post-copy confirmation', () => {
    const onReviewElsaDecision = vi.fn();
    const props = makeProps({
      onReviewElsaDecision,
      elsaDecisions: [
        {
          id: 'decision-hold-1',
          policy_decision: 'HOLD_FOR_REVIEW',
          mode: 'NEED_MORE_INFO',
          confidence: 0.88,
          normalized_tenant_reply: 'Please share a photo of the issue.',
          internal_summary: 'Need visual confirmation.',
          recommended_next_action: 'Collect photo before dispatching.',
          reviewed_at: null,
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use in message box' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion' }));

    expect(onReviewElsaDecision).toHaveBeenCalledWith('decision-hold-1', 'DISMISS');
  });

  it('opens update dialog from request card and submits management form', () => {
    const onUpdateRequest = vi.fn((event) => event?.preventDefault?.());
    const props = makeProps({ onUpdateRequest });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Update request' }));
    expect(screen.getByRole('heading', { name: 'Update request' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save updates' }));
    expect(onUpdateRequest).toHaveBeenCalledTimes(1);
  });
});

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
    attachmentDeleteStatus: 'idle',
    attachmentDeleteError: '',
    onDeleteAttachment: async () => {},
    attachmentDialogOpen: false,
    attachmentDialogMessage: '',
    dismissAttachmentDialog: () => {},
    currentUserId: 'tenant-1',
    auditEvents: [],
    auditStatus: 'idle',
    auditError: '',
    elsaSettingsError: '',
    elsaDecisionStatus: 'idle',
    elsaDecisionError: '',
    elsaDecisionActionStatus: 'idle',
    elsaDecisions: [],
    elsaAutoRespondEnabled: true,
    elsaSummarizeStatus: 'idle',
    elsaSummarizeError: '',
    elsaSummarizeText: '',
    elsaSummarizeProviderUsed: '',
    onSetElsaAutoRespond: async () => {},
    onRunElsa: async () => {},
    onSummarizeElsaRequest: async () => {},
    onDismissElsaSummary: () => {},
    onReviewElsaDecision: async () => {},
    onCancelRequest: async () => {},
    cancelStatus: 'idle',
    cancelError: '',
    subscriptionFeatures: null,
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
          created_at: '2026-04-08T11:15:00Z',
          mode: 'NEED_MORE_INFO',
          provider_used: 'remote',
          model_name: 'gemini-2.5-flash',
          confidence: 0.92,
          tenant_reply_draft: 'Please share a photo so we can schedule service.',
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
    expect(screen.getByText('Message to tenant')).toBeInTheDocument();
    expect(screen.getByText('Please share a photo so we can schedule service.')).toBeInTheDocument();
    expect(screen.getByText(`Generated: ${new Date('2026-04-08T11:15:00Z').toLocaleString()}`)).toBeInTheDocument();
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
          tenant_reply_draft: 'We have dispatched a vendor.',
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
    expect(screen.queryByRole('button', { name: 'Send Via AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use in Message Box' })).not.toBeInTheDocument();
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
          tenant_reply_draft: 'Please leave the area and call the gas utility immediately.',
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
    fireEvent.click(screen.getByRole('button', { name: 'Use in Message Box' }));

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
          tenant_reply_draft: 'Please share a photo of the issue.',
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

    fireEvent.click(screen.getByRole('button', { name: 'Use in Message Box' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss suggestion' }));

    expect(onReviewElsaDecision).toHaveBeenCalledWith('decision-hold-1', 'DISMISS');
  });

  it('opens summarize tile and dismisses it', () => {
    const onDismissElsaSummary = vi.fn();
    const { rerender } = render(
      <WithAppTheme>
        <RequestDetailPane
          {...makeProps({
            elsaSummarizeStatus: 'ok',
            elsaSummarizeText: 'Leak reported under sink; awaiting vendor.',
            elsaSummarizeProviderUsed: 'remote',
            onDismissElsaSummary,
          })}
        />
      </WithAppTheme>
    );
    expect(screen.getByText('AI summary')).toBeInTheDocument();
    expect(screen.getByText('Leak reported under sink; awaiting vendor.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismissElsaSummary).toHaveBeenCalledTimes(1);
    rerender(
      <WithAppTheme>
        <RequestDetailPane {...makeProps({ elsaSummarizeStatus: 'idle', onDismissElsaSummary })} />
      </WithAppTheme>
    );
    expect(screen.queryByText('AI summary')).not.toBeInTheDocument();
  });

  it('invokes summarize when Summarize request is clicked', () => {
    const onSummarizeElsaRequest = vi.fn();
    render(
      <WithAppTheme>
        <RequestDetailPane {...makeProps({ onSummarizeElsaRequest })} />
      </WithAppTheme>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Summarize request' }));
    expect(onSummarizeElsaRequest).toHaveBeenCalledTimes(1);
  });

  it('runs AI suggestion without opening a confirmation dialog', () => {
    const onRunElsa = vi.fn();
    const props = makeProps({ onRunElsa });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Get AI suggestion' }));
    expect(onRunElsa).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'AI suggestion ready' })).not.toBeInTheDocument();
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

  it('renders scheduled time window as a single range value', () => {
    const scheduledFrom = '2026-04-10T18:00:00Z';
    const scheduledTo = '2026-04-10T20:00:00Z';
    const props = makeProps({
      requestDetail: {
        ...makeProps().requestDetail,
        scheduled_from: scheduledFrom,
        scheduled_to: scheduledTo,
      },
    });

    const expectedWindow = `${new Date(scheduledFrom).toLocaleString()} - ${new Date(scheduledTo).toLocaleString()}`;

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Scheduled window:')).toBeInTheDocument();
    expect(screen.getByText(expectedWindow)).toBeInTheDocument();
  });

  it('shows not scheduled when no schedule window exists', () => {
    const props = makeProps();

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('Scheduled window:')).toBeInTheDocument();
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
  });

  it('shows attachment row size in MB', () => {
    const props = makeProps({
      attachments: [
        {
          id: 'att-1',
          media_type: 'PHOTO',
          file_size_bytes: 5 * 1024 * 1024,
          original_filename: 'leak.jpg',
          uploaded_by_display_name: 'Tenant One',
          uploaded_by_role: 'TENANT',
          created_at: '2026-04-10T10:00:00Z',
          file_url: '',
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    expect(screen.getByText(/Image · 5\.00 MB/i)).toBeInTheDocument();
    expect(screen.getByText('Tenant One')).toBeInTheDocument();
    expect(screen.getByText('Tenant')).toBeInTheDocument();
  });

  it('opens full image preview dialog when thumbnail is clicked', () => {
    const props = makeProps({
      attachments: [
        {
          id: 'att-preview-1',
          media_type: 'PHOTO',
          file_size_bytes: 1024,
          original_filename: 'full-leak.jpg',
          uploaded_by_display_name: 'Tenant One',
          created_at: '2026-04-10T10:00:00Z',
          file_url: 'https://example.com/full-leak.jpg',
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByLabelText('Preview: full-leak.jpg'));
    expect(screen.getByRole('heading', { name: 'full-leak.jpg' })).toBeInTheDocument();
    expect(screen.getAllByAltText('full-leak.jpg').length).toBeGreaterThan(1);
  });

  it('shows copy-link actions for each attachment and in preview dialog', () => {
    const props = makeProps({
      attachments: [
        {
          id: 'att-copy-1',
          media_type: 'PHOTO',
          file_size_bytes: 1024,
          original_filename: 'copy-photo.jpg',
          uploaded_by_display_name: 'Tenant One',
          created_at: '2026-04-10T10:00:00Z',
          file_url: 'https://example.com/copy-photo.jpg',
        },
        {
          id: 'att-copy-2',
          media_type: 'PHOTO',
          file_size_bytes: 2048,
          original_filename: 'copy-photo-2.jpg',
          uploaded_by_display_name: 'Tenant One',
          created_at: '2026-04-10T10:01:00Z',
          file_url: 'https://example.com/copy-photo-2.jpg',
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    expect(screen.getByRole('button', { name: 'Copy link for copy-photo.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link for copy-photo-2.jpg' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Preview: copy-photo.jpg'));
    expect(screen.getByRole('button', { name: 'Copy link for copy-photo.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download/i })).toBeInTheDocument();
  });

  it('navigates between image and video attachments in preview dialog', () => {
    const props = makeProps({
      attachments: [
        {
          id: 'att-media-1',
          media_type: 'PHOTO',
          file_size_bytes: 1024,
          original_filename: 'photo-one.jpg',
          uploaded_by_display_name: 'Tenant One',
          created_at: '2026-04-10T10:00:00Z',
          file_url: 'https://example.com/photo-one.jpg',
        },
        {
          id: 'att-media-2',
          media_type: 'VIDEO',
          file_size_bytes: 2048,
          original_filename: 'video-one.mp4',
          uploaded_by_display_name: 'Tenant One',
          created_at: '2026-04-10T10:01:00Z',
          file_url: 'https://example.com/video-one.mp4',
        },
      ],
    });

    render(
      <WithAppTheme>
        <RequestDetailPane {...props} />
      </WithAppTheme>
    );

    fireEvent.click(screen.getByLabelText('Preview: photo-one.jpg'));
    expect(screen.getByRole('heading', { name: 'photo-one.jpg' })).toBeInTheDocument();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'video-one.mp4' })).toBeInTheDocument();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { name: 'photo-one.jpg' })).toBeInTheDocument();
  });
});

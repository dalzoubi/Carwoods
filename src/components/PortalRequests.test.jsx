import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../i18n';
import { LanguageProvider } from '../LanguageContext';
import { ThemeModeProvider } from '../ThemeModeContext';
import PortalRequests from './PortalRequests';

const mockAuthState = {
  baseUrl: 'https://api.carwoods.com',
  isAuthenticated: true,
  account: { username: 'tenant@carwoods.com' },
  meData: { role: 'TENANT', user: { id: 'u1', role: 'TENANT', status: 'ACTIVE' } },
  meStatus: 'ok',
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
  handleApiForbidden: vi.fn(),
};

const mockRequestsState = {
  requestsStatus: 'ok',
  requestsError: '',
  requests: [],
  selectedRequestId: '',
  setSelectedRequestId: vi.fn(),
  requestDetail: null,
  detailStatus: 'idle',
  detailError: '',
  threadMessages: [],
  attachments: [],
  tenantForm: {},
  tenantDefaults: {},
  lookupStatus: 'ok',
  lookupError: '',
  lookupContact: null,
  categoryOptions: [],
  priorityOptions: [],
  tenantCreateStatus: 'idle',
  tenantCreateError: '',
  managementForm: {},
  managementStatusOptions: [],
  managementUpdateStatus: 'idle',
  managementUpdateError: '',
  messageForm: {},
  setMessageForm: vi.fn(),
  messageStatus: 'idle',
  messageError: '',
  messageDeleteStatus: 'idle',
  messageDeleteError: '',
  attachmentFile: null,
  attachmentStatus: 'idle',
  attachmentError: '',
  attachmentErrorDebugId: '',
  attachmentUploadProgress: 0,
  attachmentDeleteStatus: 'idle',
  attachmentDeleteError: '',
  attachmentRetryHint: '',
  attachmentShareStatus: 'idle',
  attachmentShareError: '',
  exportStatus: 'idle',
  exportError: '',
  auditEvents: [],
  auditStatus: 'idle',
  auditError: '',
  elsaSettingsError: '',
  elsaDecisionStatus: 'idle',
  elsaDecisionError: '',
  elsaDecisionActionStatus: 'idle',
  elsaDecisions: [],
  elsaAutoRespondEnabled: false,
  elsaSummarizeStatus: 'idle',
  elsaSummarizeError: '',
  elsaSummarizeText: '',
  elsaSummarizeProviderUsed: '',
  loadRequestDetails: vi.fn(),
  loadAuditForRequest: vi.fn(),
  loadElsaContext: vi.fn(),
  loadRequests: vi.fn(),
  onTenantField: vi.fn(),
  onCreateAttachmentChange: vi.fn(),
  onRemoveCreateAttachment: vi.fn(),
  createAttachmentFiles: [],
  onCreateRequest: vi.fn(),
  onCancelRequest: vi.fn(),
  cancelStatus: 'idle',
  cancelError: '',
  onManagementField: vi.fn(),
  onUpdateRequest: vi.fn(),
  onMessageSubmit: vi.fn(),
  onDeleteMessage: vi.fn(),
  onAttachmentChange: vi.fn(),
  onClearAttachmentFile: vi.fn(),
  onAttachmentSubmit: vi.fn(),
  onDeleteAttachment: vi.fn(),
  onShareAttachment: vi.fn(),
  onExportCsv: vi.fn(),
  onSetElsaAutoRespond: vi.fn(),
  onRunElsa: vi.fn(),
  onSummarizeElsaRequest: vi.fn(),
  onDismissElsaSummary: vi.fn(),
  onReviewElsaDecision: vi.fn(),
};

vi.mock('../PortalAuthContext', () => ({
  usePortalAuth: () => mockAuthState,
  PortalAuthProvider: ({ children }) => children,
}));

vi.mock('./portalRequests/usePortalRequests', () => ({
  usePortalRequests: () => mockRequestsState,
}));

vi.mock('./portalRequests/TenantRequestForm', () => ({
  default: () => <div data-testid="tenant-request-form" />,
}));

vi.mock('./portalRequests/RequestDetailPane', () => ({
  default: () => <div data-testid="request-detail-pane" />,
}));

describe('PortalRequests create dialog routing', () => {
  function renderAtRoute(path) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <LanguageProvider>
          <ThemeModeProvider>
            <PortalRequests />
          </ThemeModeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
  });

  it('opens create request dialog when create=1 is present in URL', () => {
    renderAtRoute('/portal/requests?create=1');

    expect(screen.getByRole('dialog', { name: /create request/i })).toBeInTheDocument();
  });

  it('keeps create request dialog closed without create query param', () => {
    renderAtRoute('/portal/requests');

    expect(screen.queryByRole('dialog', { name: /create request/i })).not.toBeInTheDocument();
  });

  it('shows empty list message in the request list when no requests are available', () => {
    renderAtRoute('/portal/requests');

    expect(screen.getByText('No requests found for this account.')).toBeInTheDocument();
  });
});

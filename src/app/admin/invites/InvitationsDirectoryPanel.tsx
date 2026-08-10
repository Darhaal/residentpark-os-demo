// Title: Invitations Directory Panel
// Path: src/app/admin/invites/InvitationsDirectoryPanel.tsx
// Functionality: Owns directory filters, cursor pagination, copy, refresh, and revoke workflows.

import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import {
  loadInvitesDirectoryAction,
  resendInviteAction,
  revokeInviteAction,
  type InvitationDirectoryRow,
} from '@/actions/invites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FILTER_ALL } from '@/config/domain';
import { PAGE_LIMITS, UI_TIMING } from '@/config/limits';
import { en } from '@/localization/en';
import type { InviteFeedbackHandlers } from './invites-types';
import { InvitationsDirectoryTable } from './InvitationsDirectoryTable';
import { RevokeInvitationModal } from './RevokeInvitationModal';

const messages = en.invitations;

interface InvitationsDirectoryPanelProps extends InviteFeedbackHandlers {
  active: boolean;
  hasMore: boolean;
  invitations: InvitationDirectoryRow[];
  setHasMore: Dispatch<SetStateAction<boolean>>;
  setInvitations: Dispatch<SetStateAction<InvitationDirectoryRow[]>>;
}

export function InvitationsDirectoryPanel({
  active,
  hasMore,
  invitations,
  setHasMore,
  setInvitations,
  showError,
  showToast,
}: InvitationsDirectoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(FILTER_ALL);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const invitationsRef = useRef(invitations);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    invitationsRef.current = invitations;
  }, [invitations]);

  useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  const fetchInvitations = useCallback(async (
    isLoadMore = false,
    nextFilters?: { search?: string; status?: string },
  ) => {
    if (isLoadMore) setIsLoadingMore(true);
    else setIsLoadingDirectory(true);

    try {
      const cursorInvite = isLoadMore && invitationsRef.current.length > 0
        ? invitationsRef.current[invitationsRef.current.length - 1]
        : null;
      const result = await loadInvitesDirectoryAction({
        limit: PAGE_LIMITS.invitations,
        search: (nextFilters?.search ?? debouncedSearch) || null,
        statusFilter: nextFilters?.status ?? filterStatus,
        cursorCreatedAt: cursorInvite?.created_at ?? null,
        cursorId: cursorInvite?.id ?? null,
      });

      if (!result.success) {
        showError(result.error || messages.loadError);
        if (!isLoadMore) setInvitations([]);
        setHasMore(false);
        return;
      }

      setInvitations((current) => isLoadMore ? [...current, ...result.invitations] : result.invitations);
      setHasMore(result.hasMore);
    } catch {
      showError(messages.loadError);
      if (!isLoadMore) setInvitations([]);
      setHasMore(false);
    } finally {
      if (isLoadMore) setIsLoadingMore(false);
      else setIsLoadingDirectory(false);
    }
  }, [debouncedSearch, filterStatus, setHasMore, setInvitations, showError]);

  useEffect(() => {
    if (active && !wasActiveRef.current) void fetchInvitations(false);
    wasActiveRef.current = active;
  }, [active, fetchInvitations]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      if (active) void fetchInvitations(false, { search: value, status: filterStatus });
    }, UI_TIMING.searchDebounceMs);
  };

  const handleStatusFilterChange = (value: string) => {
    setFilterStatus(value);
    if (active) void fetchInvitations(false, { search: debouncedSearch, status: value });
  };

  const handleRevokeConfirm = async () => {
    if (!revokeConfirmId) return;
    setIsActionLoading(revokeConfirmId);

    try {
      const result = await revokeInviteAction(revokeConfirmId);
      if (!result.success) {
        showError(result.error || messages.revokeError);
        return;
      }

      await fetchInvitations(false);
      showToast(messages.revokedToast);
    } catch {
      showError(messages.revokeError);
    } finally {
      setIsActionLoading(null);
      setRevokeConfirmId(null);
    }
  };

  const handleResend = async (id: string) => {
    setIsActionLoading(id);
    try {
      const result = await resendInviteAction(id);
      if (!result.success) {
        showError(result.error || messages.resendError);
        return;
      }

      await fetchInvitations(false);
      showToast(messages.resentToast);
    } catch {
      showError(messages.resendError);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleCopyLink = async (token: string) => {
    const link = `${window.location.origin}/register?invite=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast(messages.linkCopiedToast);
    } catch {
      showError(messages.linkCopyError);
    }
  };

  return (
    <section
      id="invitations-directory-panel"
      role="tabpanel"
      aria-labelledby="invitations-directory-tab"
      hidden={!active}
      className={active ? 'overflow-hidden rounded-md border border-border bg-card shadow-sm' : 'hidden'}
    >
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{messages.directoryTitle}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{messages.directoryDescription}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label={messages.searchAria}
              placeholder={messages.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <select
            aria-label={messages.statusFilterAria}
            value={filterStatus}
            onChange={(event) => handleStatusFilterChange(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value={FILTER_ALL}>{messages.allStatuses}</option>
            <option value="pending">{messages.statusLabels.pending}</option>
            <option value="accepted">{messages.statusLabels.accepted}</option>
            <option value="expired">{messages.statusLabels.expired}</option>
            <option value="revoked">{messages.statusLabels.revoked}</option>
          </select>
        </div>
      </div>

      <InvitationsDirectoryTable
        invitations={invitations}
        isActionLoading={isActionLoading}
        isLoading={isLoadingDirectory}
        onCopyLink={handleCopyLink}
        onResend={handleResend}
        onRevoke={setRevokeConfirmId}
      />

      {hasMore && (
        <div className="flex justify-center border-t border-border bg-muted/20 p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => fetchInvitations(true)} disabled={isLoadingMore}>
            {isLoadingMore && <Spinner className="size-3.5" aria-hidden="true" />}
            {messages.loadMore}
          </Button>
        </div>
      )}

      {revokeConfirmId && (
        <RevokeInvitationModal
          isLoading={isActionLoading === revokeConfirmId}
          onClose={() => setRevokeConfirmId(null)}
          onConfirm={handleRevokeConfirm}
        />
      )}
    </section>
  );
}

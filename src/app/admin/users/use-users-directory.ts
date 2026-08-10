// Title: Users Directory State Hook
// Path: src/app/admin/users/use-users-directory.ts
// Functionality: Owns all state, data loading and mutations for the admin identity
//   directory — filtering, cursor pagination, row selection, bulk actions, account
//   creation and the per-user edit/status flow. Presentational pieces consume the
//   returned values. Extracted from UsersClient to keep that file composition-only.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateUserPermissionsAction,
  updateUserStatusAction,
  bulkUpdateUserStatusAction,
  bulkUpdatePermissionsAction,
  createUserAccountAction,
} from '@/actions/users';
import { loadUsersDirectoryAction } from '@/actions/loaders';
import { useFeedback } from '@/hooks/use-feedback';
import { en as locale } from '@/localization/en';
import { ACCOUNT_STATUS, FILTER_ALL, USER_ROLES } from '@/config/domain';
import { PAGE_LIMITS, UI_TIMING } from '@/config/limits';
import { ROUTES } from '@/config/routes';
import {
  roleChangeIntent,
  type ApartmentOption,
  type BulkIntent,
  type CreateAccountData,
  type EditableRole,
  type Profile,
  type UserRole,
} from './users-types';

const messages = locale.adminUsers;

export interface UsersClientProps {
  initialProfiles: Profile[];
  initialApartments: ApartmentOption[];
  initialHasMore: boolean;
  canCreateAdmins: boolean;
  initialFilters: {
    search: string;
    role: string;
    status: string;
  };
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return fallback;
};

const toUserRole = (role: string): UserRole => {
  if (role === USER_ROLES.admin || role === USER_ROLES.superadmin) return role;
  return USER_ROLES.resident;
};

const buildUsersQuery = (filters: UsersClientProps['initialFilters']) => {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.role && filters.role !== FILTER_ALL) params.set('role', filters.role);
  if (filters.status && filters.status !== FILTER_ALL) params.set('status', filters.status);
  return params.toString();
};

export function useUsersDirectory({ initialProfiles, initialApartments, initialHasMore, initialFilters }: UsersClientProps) {
  const router = useRouter();
  const { errorMsg, successMsg, showToast, showError, clearFeedback } = useFeedback();

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [allApartments, setAllApartments] = useState<ApartmentOption[]>(initialApartments);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [filterRole, setFilterRole] = useState(initialFilters.role || FILTER_ALL);
  const [filterStatus, setFilterStatus] = useState(initialFilters.status || FILTER_ALL);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkIntent, setBulkIntent] = useState<BulkIntent | null>(null);
  const [bulkRole, setBulkRole] = useState<EditableRole>(USER_ROLES.resident);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [newRole, setNewRole] = useState<UserRole>(USER_ROLES.resident);
  const [isManager, setIsManager] = useState(false);
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [suspendConfirmVisible, setSuspendConfirmVisible] = useState(false);
  const [createAccountVisible, setCreateAccountVisible] = useState(false);

  const filters = useMemo(() => ({
    search: searchQuery,
    role: filterRole,
    status: filterStatus,
  }), [searchQuery, filterRole, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const query = buildUsersQuery(filters);
      router.replace(query ? `${ROUTES.admin.users}?${query}` : ROUTES.admin.users, { scroll: false });
    }, UI_TIMING.searchDebounceMs);

    return () => clearTimeout(timer);
  }, [filters, router]);

  const fetchUsers = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setIsLoadingMore(true);

    try {
      const last = isLoadMore && profiles.length > 0 ? profiles[profiles.length - 1] : null;
      const res = await loadUsersDirectoryAction({
        cursorCreatedAt: last?.created_at ?? null,
        cursorId: last?.id ?? null,
        limit: PAGE_LIMITS.users,
        search: searchQuery || null,
        roleFilter: filterRole,
        statusFilter: filterStatus,
      });

      if (!res.success) throw new Error(res.error);

      const data = Array.isArray(res.users) ? (res.users as unknown as Profile[]) : [];
      setAllApartments((res.apartments || []) as ApartmentOption[]);
      setProfiles(prev => isLoadMore ? [...prev, ...data] : data);
      setHasMore(res.hasMore);
    } catch (error) {
      showError(getErrorMessage(error, messages.criticalLoadError));
    } finally {
      setIsLoadingMore(false);
    }
  }, [profiles, searchQuery, filterRole, filterStatus, showError]);

  const toggleAll = () => {
    if (selectedIds.size === profiles.length && profiles.length > 0) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(profiles.map(profile => profile.id)));
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const clearBulkModal = () => {
    setBulkIntent(null);
    setActionReason('');
  };

  const handleBulkCommit = async () => {
    if (!bulkIntent || selectedIds.size === 0 || !actionReason.trim()) return;
    setIsSaving(true);

    try {
      const ids = Array.from(selectedIds);
      const res = bulkIntent === roleChangeIntent
        ? await bulkUpdatePermissionsAction(ids, bulkRole, actionReason)
        : await bulkUpdateUserStatusAction(ids, bulkIntent, actionReason);

      if (!res.success) {
        showError(res.error || messages.operationFailed);
        return;
      }

      await fetchUsers();
      clearBulkModal();
      setSelectedIds(new Set());
      showToast(messages.bulkOperationToast);
      router.refresh();
    } catch (error) {
      showError(getErrorMessage(error, messages.internalException));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAccount = async (data: CreateAccountData) => {
    setIsSaving(true);
    clearFeedback();

    try {
      const res = await createUserAccountAction(data);
      if (!res.success) {
        showError(res.error || messages.createAccountError);
        return;
      }

      setCreateAccountVisible(false);
      await fetchUsers();
      showToast(messages.accountCreatedToast);
      router.refresh();
    } catch (error) {
      showError(getErrorMessage(error, messages.createAccountError));
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (user: Profile) => {
    setSelectedUser(user);
    setNewRole(toUserRole(user.role));
    setIsManager(user.is_apartment_manager);
    setConfirmPassword('');
    setActionReason(user.approval_status === ACCOUNT_STATUS.pendingApproval ? messages.defaultPendingReason : '');
    setSelectedApartmentId(user.apartment_id || '');
    setSuspendConfirmVisible(false);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setIsSaving(true);

    try {
      const res = await updateUserPermissionsAction({
        targetUserId: selectedUser.id,
        newRole,
        isManager,
        newApartmentId: selectedApartmentId || null,
        reason: actionReason,
        confirmPassword,
      });

      if (!res.success) throw new Error(res.error);

      showToast(messages.permissionsUpdatedToast);
      setSelectedUser(null);
      await fetchUsers();
    } catch (error) {
      showError(getErrorMessage(error, messages.signatureFailed));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (newStatus: typeof ACCOUNT_STATUS.approved | typeof ACCOUNT_STATUS.suspended | typeof ACCOUNT_STATUS.rejected) => {
    if (!selectedUser || !actionReason.trim()) return;
    setIsSaving(true);

    try {
      const res = await updateUserStatusAction(selectedUser.id, newStatus, actionReason);
      if (!res.success) {
        showError(res.error || messages.operationFailed);
        return;
      }

      showToast(messages.accountStatusToast(newStatus));
      setActionReason('');
      setSuspendConfirmVisible(false);
      if (selectedUser.approval_status === ACCOUNT_STATUS.pendingApproval) setSelectedUser(null);
      await fetchUsers();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return {
    // feedback
    errorMsg, successMsg, clearFeedback,
    // data
    profiles, allApartments, hasMore, isLoadingMore, fetchUsers,
    // filters
    searchQuery, setSearchQuery, filterRole, setFilterRole, filterStatus, setFilterStatus,
    // selection + bulk
    selectedIds, toggleAll, toggleRow, clearSelection,
    bulkIntent, setBulkIntent, bulkRole, setBulkRole, clearBulkModal, handleBulkCommit,
    // edit flow
    selectedUser, setSelectedUser, newRole, setNewRole, isManager, setIsManager,
    selectedApartmentId, setSelectedApartmentId, actionReason, setActionReason,
    confirmPassword, setConfirmPassword, isSaving,
    suspendConfirmVisible, setSuspendConfirmVisible,
    createAccountVisible, setCreateAccountVisible,
    openEditModal, handleSaveProfile, handleToggleStatus, handleCreateAccount,
  };
}

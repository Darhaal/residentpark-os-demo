// Title: Approvals Workflow Controller
// Path: src/app/admin/approvals/use-approvals-controller.ts
// Functionality: Owns approval queue state, selections, modal intents, mutations, and refresh transitions.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { processAccountRequest } from '@/actions/approvals';
import { loadPendingApprovalsAction } from '@/actions/loaders';
import { bulkReviewVehiclesAction, reviewVehicleAction, submitVehicleRequestAction } from '@/actions/parking';
import { approveAndAssignUnitAction, bulkApproveAndAssignUnitsAction } from '@/actions/quick-approve';
import { bulkUpdateUserStatusAction } from '@/actions/users';
import type { ExtendedApartmentObj, VehicleFormData } from '@/components/shared/VehicleForm';
import { ADMIN_APPROVALS_CONFIG } from '@/config/admin-clients';
import { ACCOUNT_STATUS, VEHICLE_APPROVAL_STATUS } from '@/config/domain';
import { useFeedback } from '@/hooks/use-feedback';
import { en } from '@/localization/en';
import {
  removeApprovalSelection,
  toggleAllApprovalSelections,
  toggleApprovalSelection,
} from './approval-selection';
import type {
  ApprovalBulkIntent,
  ApprovalRejectType,
  ApprovalTab,
  ApprovalsClientProps,
  PendingAccount,
  PendingVehicle,
} from './approvals-types';

const messages = en.adminApprovals;
const tabs = ADMIN_APPROVALS_CONFIG.tabs;
const processingIds = ADMIN_APPROVALS_CONFIG.processingIds;

export function useApprovalsController({
  initialPendingAccounts,
  initialPendingVehicles,
  initialApartments,
}: ApprovalsClientProps) {
  const router = useRouter();
  const feedback = useFeedback();
  const [activeTab, setActiveTab] = useState<ApprovalTab>(tabs.accounts);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>(initialPendingAccounts);
  const [pendingVehicles, setPendingVehicles] = useState<PendingVehicle[]>(initialPendingVehicles);
  const [apartments, setApartments] = useState<ExtendedApartmentObj[]>(initialApartments);
  const [selectedApts, setSelectedApts] = useState<Record<string, string>>({});
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<Set<string>>(new Set());
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectType, setRejectType] = useState<ApprovalRejectType | null>(null);
  const [bulkIntent, setBulkIntent] = useState<ApprovalBulkIntent | null>(null);
  const [submitVehicleModal, setSubmitVehicleModal] = useState(false);
  const [actionReason, setActionReason] = useState('');

  const clearModals = () => {
    setRejectModalId(null);
    setRejectType(null);
    setBulkIntent(null);
    setSubmitVehicleModal(false);
    setActionReason('');
  };

  const refreshQueue = async () => {
    feedback.clearFeedback();
    try {
      const result = await loadPendingApprovalsAction();
      if (!result.success) {
        feedback.showError(result.error || messages.loadError);
        return false;
      }

      setApartments(result.apartments as ExtendedApartmentObj[]);
      setPendingAccounts(result.pendingAccounts as PendingAccount[]);
      setPendingVehicles(result.pendingVehicles as PendingVehicle[]);
      setSelectedAccountIds(new Set());
      setSelectedVehicleIds(new Set());
      return true;
    } catch {
      feedback.showError(messages.loadError);
      return false;
    }
  };

  const handleApproveAccount = async (targetId: string) => {
    setIsProcessingId(targetId);
    try {
      const apartmentId = selectedApts[targetId] || null;
      const result = await approveAndAssignUnitAction(targetId, apartmentId, messages.defaultReasons.accountApproval);
      if (!result.success) {
        feedback.showError(result.error || messages.approvalError);
        return;
      }

      setPendingAccounts((current) => current.filter((account) => account.id !== targetId));
      setSelectedAccountIds((current) => removeApprovalSelection(current, targetId));
      feedback.showToast(messages.accountApprovedToast);
      router.refresh();
    } catch {
      feedback.showError(messages.approvalError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleRejectAccount = async (targetId: string) => {
    setIsProcessingId(targetId);
    try {
      const result = await processAccountRequest(
        targetId,
        ACCOUNT_STATUS.rejected,
        actionReason || messages.defaultReasons.accountRejection,
      );
      if (!result.success) {
        feedback.showError(result.error || messages.rejectAccountError);
        return;
      }

      setPendingAccounts((current) => current.filter((account) => account.id !== targetId));
      setSelectedAccountIds((current) => removeApprovalSelection(current, targetId));
      clearModals();
      feedback.showToast(messages.accountRejectedToast);
      router.refresh();
    } catch {
      feedback.showError(messages.rejectAccountError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleApproveVehicle = async (id: string) => {
    setIsProcessingId(id);
    try {
      const result = await reviewVehicleAction(id, VEHICLE_APPROVAL_STATUS.approved, messages.defaultReasons.vehicleApproval);
      if (!result.success) {
        feedback.showError(result.error || messages.approveVehicleError);
        return;
      }

      setPendingVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
      setSelectedVehicleIds((current) => removeApprovalSelection(current, id));
      feedback.showToast(messages.vehicleApprovedToast);
      router.refresh();
    } catch {
      feedback.showError(messages.approveVehicleError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleRejectVehicle = async (id: string) => {
    setIsProcessingId(id);
    try {
      const result = await reviewVehicleAction(
        id,
        VEHICLE_APPROVAL_STATUS.rejected,
        actionReason || messages.defaultReasons.vehicleRejection,
      );
      if (!result.success) {
        feedback.showError(result.error || messages.rejectVehicleError);
        return;
      }

      setPendingVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
      setSelectedVehicleIds((current) => removeApprovalSelection(current, id));
      clearModals();
      feedback.showToast(messages.vehicleRejectedToast);
      router.refresh();
    } catch {
      feedback.showError(messages.rejectVehicleError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleSubmitVehicleRequest = async (data: VehicleFormData) => {
    setIsProcessingId(processingIds.submitVehicle);
    try {
      const result = await submitVehicleRequestAction(data);
      if (!result.success) {
        feedback.showError(result.error || messages.submitVehicleError);
        return;
      }

      await refreshQueue();
      clearModals();
      feedback.showToast(messages.vehicleSubmittedToast);
    } catch {
      feedback.showError(messages.submitVehicleError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleBulkCommit = async () => {
    if (!bulkIntent || !actionReason.trim()) return;

    if (activeTab === tabs.accounts) {
      const selectedIds = new Set(selectedAccountIds);
      if (selectedIds.size === 0) return;
      setIsProcessingId(processingIds.bulkAccount);

      try {
        if (bulkIntent === ACCOUNT_STATUS.approved) {
          const targets = Array.from(selectedIds).map((id) => ({
            targetUserId: id,
            apartmentId: selectedApts[id] || null,
          }));
          const result = await bulkApproveAndAssignUnitsAction(targets, actionReason);
          if (!result.success) {
            feedback.showError(result.error || messages.bulkApproveAccountsError);
            return;
          }
          feedback.showToast(messages.bulkApproveAccountsToast(selectedIds.size));
        } else {
          const result = await bulkUpdateUserStatusAction(Array.from(selectedIds), ACCOUNT_STATUS.rejected, actionReason);
          if (!result.success) {
            feedback.showError(result.error || messages.bulkRejectAccountsError);
            return;
          }
          feedback.showToast(messages.bulkRejectAccountsToast(selectedIds.size));
        }

        setPendingAccounts((current) => current.filter((account) => !selectedIds.has(account.id)));
        setSelectedAccountIds(new Set());
        clearModals();
        router.refresh();
      } catch {
        feedback.showError(
          bulkIntent === ACCOUNT_STATUS.approved
            ? messages.bulkApproveAccountsError
            : messages.bulkRejectAccountsError,
        );
      } finally {
        setIsProcessingId(null);
      }
      return;
    }

    const selectedIds = new Set(selectedVehicleIds);
    if (selectedIds.size === 0) return;
    setIsProcessingId(processingIds.bulkVehicle);

    try {
      const result = await bulkReviewVehiclesAction(Array.from(selectedIds), bulkIntent, actionReason);
      if (!result.success) {
        feedback.showError(result.error || messages.bulkVehiclesError);
        return;
      }

      setPendingVehicles((current) => current.filter((vehicle) => !selectedIds.has(vehicle.id)));
      setSelectedVehicleIds(new Set());
      clearModals();
      feedback.showToast(messages.bulkVehiclesToast(bulkIntent, selectedIds.size));
      router.refresh();
    } catch {
      feedback.showError(messages.bulkVehiclesError);
    } finally {
      setIsProcessingId(null);
    }
  };

  const selectedCount = activeTab === tabs.accounts ? selectedAccountIds.size : selectedVehicleIds.size;
  const handleRejectConfirm = () => {
    if (!rejectModalId || !rejectType) return;
    if (rejectType === 'account') void handleRejectAccount(rejectModalId);
    else void handleRejectVehicle(rejectModalId);
  };

  return {
    ...feedback,
    activeTab,
    setActiveTab,
    pendingAccounts,
    pendingVehicles,
    apartments,
    selectedApts,
    setSelectedApts,
    selectedAccountIds,
    selectedVehicleIds,
    isProcessingId,
    rejectModalId,
    rejectType,
    bulkIntent,
    submitVehicleModal,
    actionReason,
    setActionReason,
    selectedCount,
    setBulkIntent,
    setSubmitVehicleModal,
    clearModals,
    clearSelection: () => {
      if (activeTab === tabs.accounts) setSelectedAccountIds(new Set());
      else setSelectedVehicleIds(new Set());
    },
    toggleAllAccounts: () => setSelectedAccountIds((current) =>
      toggleAllApprovalSelections(current, pendingAccounts.map((account) => account.id))),
    toggleAllVehicles: () => setSelectedVehicleIds((current) =>
      toggleAllApprovalSelections(current, pendingVehicles.map((vehicle) => vehicle.id))),
    toggleAccountRow: (id: string) => setSelectedAccountIds((current) => toggleApprovalSelection(current, id)),
    toggleVehicleRow: (id: string) => setSelectedVehicleIds((current) => toggleApprovalSelection(current, id)),
    openReject: (id: string, type: ApprovalRejectType) => {
      setRejectModalId(id);
      setRejectType(type);
    },
    handleApproveAccount,
    handleRejectAccount,
    handleApproveVehicle,
    handleRejectVehicle,
    handleRejectConfirm,
    handleSubmitVehicleRequest,
    handleBulkCommit,
  };
}

// Title: Approvals Client
// Path: src/app/admin/approvals/ApprovalsClient.tsx
// Functionality: Composes approval queue panels, bulk controls, overlays, and the workflow controller.

'use client';

import { FeedbackToasts } from '@/components/shared/FeedbackToasts';
import { ADMIN_APPROVALS_CONFIG } from '@/config/admin-clients';
import { ACCOUNT_STATUS } from '@/config/domain';
import { AccountsTable } from './AccountsTable';
import { ApprovalsBulkBar } from './ApprovalsBulkBar';
import { ApprovalsOverview } from './ApprovalsOverview';
import { BulkApprovalModal } from './BulkApprovalModal';
import { RejectReasonModal } from './RejectReasonModal';
import { SubmitVehicleModal } from './SubmitVehicleModal';
import type { ApprovalsClientProps } from './approvals-types';
import { useApprovalsController } from './use-approvals-controller';
import { VehiclesTable } from './VehiclesTable';

export type { PendingAccount, PendingVehicle } from './approvals-types';

const tabs = ADMIN_APPROVALS_CONFIG.tabs;
const processingIds = ADMIN_APPROVALS_CONFIG.processingIds;

export function ApprovalsClient(props: ApprovalsClientProps) {
  const controller = useApprovalsController(props);

  return (
    <main className="flex-1 overflow-y-auto bg-muted/30 px-4 py-5 pb-24 sm:px-6 lg:px-8">
      <FeedbackToasts
        successMsg={controller.successMsg}
        errorMsg={controller.errorMsg}
        onClear={controller.clearFeedback}
      />

      <div className="mx-auto max-w-6xl space-y-5">
        <ApprovalsOverview
          activeTab={controller.activeTab}
          accountCount={controller.pendingAccounts.length}
          vehicleCount={controller.pendingVehicles.length}
          apartmentCount={controller.apartments.length}
          onTabChange={controller.setActiveTab}
          onAddVehicle={() => controller.setSubmitVehicleModal(true)}
        />

        <div
          id="approvals-accounts-panel"
          role="tabpanel"
          aria-labelledby="approvals-accounts-tab"
          hidden={controller.activeTab !== tabs.accounts}
          className={controller.activeTab === tabs.accounts ? 'block' : 'hidden'}
        >
          <AccountsTable
            accounts={controller.pendingAccounts}
            apartments={controller.apartments}
            selectedIds={controller.selectedAccountIds}
            selectedApts={controller.selectedApts}
            processingId={controller.isProcessingId}
            onToggleAll={controller.toggleAllAccounts}
            onToggleRow={controller.toggleAccountRow}
            onSetApt={(id, value) => controller.setSelectedApts((current) => ({ ...current, [id]: value }))}
            onReject={(id) => controller.openReject(id, 'account')}
            onApprove={controller.handleApproveAccount}
          />
        </div>

        <div
          id="approvals-vehicles-panel"
          role="tabpanel"
          aria-labelledby="approvals-vehicles-tab"
          hidden={controller.activeTab !== tabs.vehicles}
          className={controller.activeTab === tabs.vehicles ? 'block' : 'hidden'}
        >
          <VehiclesTable
            vehicles={controller.pendingVehicles}
            selectedIds={controller.selectedVehicleIds}
            processingId={controller.isProcessingId}
            onToggleAll={controller.toggleAllVehicles}
            onToggleRow={controller.toggleVehicleRow}
            onReject={(id) => controller.openReject(id, 'vehicle')}
            onApprove={controller.handleApproveVehicle}
          />
        </div>
      </div>

      {controller.selectedCount > 0 && !controller.bulkIntent && (
        <ApprovalsBulkBar
          count={controller.selectedCount}
          onApprove={() => controller.setBulkIntent(ACCOUNT_STATUS.approved)}
          onReject={() => controller.setBulkIntent(ACCOUNT_STATUS.rejected)}
          onClear={controller.clearSelection}
        />
      )}

      {controller.rejectModalId && controller.rejectType && (
        <RejectReasonModal
          reason={controller.actionReason}
          setReason={controller.setActionReason}
          isProcessing={controller.isProcessingId === controller.rejectModalId}
          onCancel={controller.clearModals}
          onConfirm={controller.handleRejectConfirm}
        />
      )}

      {controller.bulkIntent && (
        <BulkApprovalModal
          intent={controller.bulkIntent}
          selectedCount={controller.selectedCount}
          reason={controller.actionReason}
          setReason={controller.setActionReason}
          isProcessing={Boolean(controller.isProcessingId?.startsWith(processingIds.bulkPrefix))}
          onCancel={controller.clearModals}
          onCommit={controller.handleBulkCommit}
        />
      )}

      {controller.submitVehicleModal && (
        <SubmitVehicleModal
          apartments={controller.apartments}
          isProcessing={controller.isProcessingId === processingIds.submitVehicle}
          onSubmit={controller.handleSubmitVehicleRequest}
          onCancel={controller.clearModals}
        />
      )}
    </main>
  );
}

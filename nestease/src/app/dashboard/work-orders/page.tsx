"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { KanbanBoard } from "@/components/kanban-board";
import { KanbanWorkOrder } from "@/components/kanban-card";
import { WorkOrderDetail } from "@/components/work-order-detail";
import { AssignContractorModal } from "@/components/assign-contractor-modal";
import { WorkOrderStatus } from "@/types";

export default function KanbanPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [workOrders, setWorkOrders] = useState<KanbanWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("selected"));
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [pmId, setPmId] = useState<string | null>(null);

  // Look up pm.id from auth user id
  useEffect(() => {
    if (!user) return;
    supabaseBrowser.from("pm").select("id").eq("auth_id", user.id).single()
      .then(({ data }) => { if (data) setPmId(data.id); });
  }, [user]);

  const fetchWorkOrders = useCallback(async () => {
    if (!pmId) return;
    try {
      const res = await api.listWorkOrders(pmId);
      setWorkOrders(res.data as KanbanWorkOrder[]);
    } catch {
      // silently fail on fetch error
    } finally {
      setLoading(false);
    }
  }, [pmId]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  // Supabase Realtime: auto-refresh when work_order table changes
  useEffect(() => {
    if (!pmId) return;
    const channel = supabaseBrowser
      .channel("work-orders-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "work_order" },
        () => { fetchWorkOrders(); }
      )
      .subscribe();
    return () => { supabaseBrowser.removeChannel(channel); };
  }, [pmId, fetchWorkOrders]);

  const handleTransition = async (workOrderId: string, action: string): Promise<boolean> => {
    try {
      await api.transition(workOrderId, {
        action,
        actor_id: pmId,
        actor_role: "pm",
      });
      await fetchWorkOrders();
      return true;
    } catch {
      return false;
    }
  };

  const handleAssignContractor = async (workOrderId: string, contractorId: string) => {
    try {
      await api.transition(workOrderId, {
        action: "pm_assign_contractor",
        actor_id: pmId,
        actor_role: "pm",
        contractor_id: contractorId,
      });
      await fetchWorkOrders();
      setAssigningId(null);
    } catch {
      // handle error
    }
  };

  if (loading) {
    return (
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 p-4">
          <div className="flex gap-4 h-full">
            {[...Array(4)].map((_, col) => (
              <div key={col} className="flex-1 space-y-3">
                <div className="h-8 w-full bg-gray-200 rounded-lg animate-pulse" />
                {[...Array(col === 0 ? 3 : col === 1 ? 2 : 1)].map((_, row) => (
                  <div key={row} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          workOrders={workOrders}
          onTransition={handleTransition}
          onCardClick={(id) => setSelectedId(id)}
          onAssignContractor={(id) => setAssigningId(id)}
          onBackgroundClick={() => setSelectedId(null)}
        />
      </div>

      {/* Work order detail slide-out panel */}
      <div
        className={`transition-all duration-300 ease-out overflow-hidden ${
          selectedId ? "w-[480px] opacity-100" : "w-0 opacity-0"
        }`}
      >
        {selectedId && (
          <WorkOrderDetail
            workOrderId={selectedId}
            pmId={pmId!}
            onClose={() => setSelectedId(null)}
            onRefresh={fetchWorkOrders}
            onAssignContractor={(id) => { setSelectedId(null); setAssigningId(id); }}
          />
        )}
      </div>

      {/* Assign contractor modal */}
      {assigningId && (
        <AssignContractorModal
          pmId={pmId!}
          workOrderCategory={(workOrders.find((wo) => wo.id === assigningId) as Record<string, unknown> | undefined)?.category as string | undefined}
          onAssign={(contractorId) => handleAssignContractor(assigningId, contractorId)}
          onClose={() => setAssigningId(null)}
        />
      )}
    </div>
  );
}

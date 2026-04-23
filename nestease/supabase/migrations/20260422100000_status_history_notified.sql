-- Add contractor_notified flag to prevent duplicate outbound notifications
-- during zero-downtime deployments (multiple instances processing same Realtime event)
ALTER TABLE work_order_status_history
  ADD COLUMN contractor_notified BOOLEAN DEFAULT false;

import { Urgency } from "@/types";

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency !== Urgency.Urgent) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626]">
      紧急
    </span>
  );
}

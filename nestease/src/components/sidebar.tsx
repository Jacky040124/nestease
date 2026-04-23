"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Logo } from "@/components/logo";
import { supabaseBrowser } from "@/lib/supabase-browser";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  comingSoon?: boolean;
}

// Fixed items (not draggable)
const OVERVIEW_ITEM: NavItem = { href: "/dashboard", label: "总览", icon: "chart" };
const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "设置", icon: "settings" };

// Sortable items (default order)
const DEFAULT_SORTABLE_ITEMS: NavItem[] = [
  { href: "/dashboard/work-orders", label: "工单管理", icon: "clipboard" },
  { href: "/dashboard/properties", label: "物业管理", icon: "home" },
  { href: "/dashboard/contractors", label: "工人管理", icon: "wrench" },
  { href: "/dashboard/agent", label: "智能体管理", icon: "bot" },
  { href: "/dashboard/accounting", label: "账目管理", icon: "dollar", comingSoon: true },
  { href: "/dashboard/reports", label: "业主报告", icon: "doc", comingSoon: true },
  { href: "/dashboard/leases", label: "租约管理", icon: "calendar", comingSoon: true },
  { href: "/dashboard/leasing", label: "招租管理", icon: "building", comingSoon: true },
];

const STORAGE_KEY = "nestease-sidebar-order";

function loadOrder(): string[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveOrder(hrefs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hrefs));
  } catch {
    // ignore
  }
}

function applySavedOrder(items: NavItem[]): NavItem[] {
  const saved = loadOrder();
  if (!saved) return items;

  const itemMap = new Map(items.map((item) => [item.href, item]));
  const ordered: NavItem[] = [];

  // Add items in saved order
  for (const href of saved) {
    const item = itemMap.get(href);
    if (item) {
      ordered.push(item);
      itemMap.delete(href);
    }
  }

  // Append any new items not in saved order
  for (const item of itemMap.values()) {
    ordered.push(item);
  }

  return ordered;
}

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  clipboard: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  wrench: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L12 4.37m-5.68 5.7h15.08M20.58 8.83l5.1 5.1m0 0L20 19.63m5.68-5.7H10.6" />
    </svg>
  ),
  dollar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  doc: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  building: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  bot: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h9a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0015.75 4.5h-9A2.25 2.25 0 004.5 6.75v10.5A2.25 2.25 0 006.75 19.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10.5h.008v.008H9V10.5zm6 0h.008v.008H15V10.5zm-4.5 3.75h3" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  if (item.comingSoon) {
    return (
      <div
        className={`flex items-center gap-2 h-8 px-3 rounded text-sm font-medium text-gray-400 cursor-default
          ${collapsed ? "justify-center" : ""}
        `}
        title={collapsed ? item.label : undefined}
      >
        {ICONS[item.icon]}
        {!collapsed && (
          <span className="flex-1 flex items-center gap-2">
            {item.label}
            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full leading-none">
              Soon
            </span>
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2 h-8 px-3 rounded text-sm font-medium transition-colors
        ${isActive
          ? "bg-brand-50 text-brand-600 font-semibold"
          : "text-gray-500 hover:bg-[#F1F3F5] hover:text-gray-900"
        }
        ${collapsed ? "justify-center" : ""}
      `}
      title={collapsed ? item.label : undefined}
    >
      {ICONS[item.icon]}
      {!collapsed && (
        <span className="flex-1 flex items-center gap-2">
          {item.label}
        </span>
      )}
    </Link>
  );
}

function SortableNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.href });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      {!collapsed && (
        <button
          {...attributes}
          {...listeners}
          className="w-4 h-8 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          tabIndex={-1}
          aria-label={`拖拽排序 ${item.label}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="4" r="1.5" />
            <circle cx="11" cy="4" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="11" cy="12" r="1.5" />
          </svg>
        </button>
      )}
      <div className="flex-1">
        <NavLink item={item} isActive={isActive} collapsed={collapsed} />
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [pmName, setPmName] = useState<string | null>(null);
  const [sortableItems, setSortableItems] = useState(DEFAULT_SORTABLE_ITEMS);
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  useEffect(() => {
    setSortableItems(applySavedOrder(DEFAULT_SORTABLE_ITEMS));
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    supabaseBrowser
      .from("pm")
      .select("name")
      .eq("email", user.email)
      .single()
      .then(({ data }) => { if (data) setPmName(data.name); });
  }, [user?.email]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSortableItems((items) => {
      const oldIndex = items.findIndex((i) => i.href === active.id);
      const newIndex = items.findIndex((i) => i.href === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      saveOrder(newItems.map((i) => i.href));
      return newItems;
    });
  }, []);

  const isActive = (item: NavItem) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <aside
      className={`flex flex-col border-r border-[#F3F4F6] bg-[#F8F9FA] transition-[width] shrink-0 ${
        collapsed ? "w-14" : "w-60"
      }`}
      style={{ transitionDuration: "var(--duration-normal)", transitionTimingFunction: "var(--easing-default)" }}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-[#F3F4F6]">
        <Link href="/dashboard" className="flex items-center gap-2 text-brand-600">
          <Logo size={collapsed ? 20 : 22} />
          {!collapsed && <span className="text-sm font-bold tracking-tight">栖安</span>}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`text-gray-400 hover:text-gray-600 transition-colors ${collapsed ? "hidden" : ""}`}
          title="折叠侧边栏"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="展开侧边栏"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Main Nav */}
      <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
        {/* Overview — fixed at top */}
        <NavLink item={OVERVIEW_ITEM} isActive={isActive(OVERVIEW_ITEM)} collapsed={collapsed} />

        {/* Sortable items */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableItems.map((i) => i.href)} strategy={verticalListSortingStrategy}>
            {sortableItems.map((item) => (
              <SortableNavItem
                key={item.href}
                item={item}
                isActive={isActive(item)}
                collapsed={collapsed}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Divider before settings */}
        <div className="!mt-2 !mb-2 border-t border-[#F3F4F6]" />

        {/* Settings — fixed at bottom of nav */}
        <NavLink item={SETTINGS_ITEM} isActive={isActive(SETTINGS_ITEM)} collapsed={collapsed} />
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-[#F3F4F6]">
        <button
          onClick={signOut}
          className={`flex items-center gap-2 w-full h-8 px-3 rounded text-sm text-gray-500
                      hover:bg-[#F1F3F5] hover:text-gray-900 transition-colors
                      ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "登出" : undefined}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>{pmName || user?.email?.split("@")[0] || "登出"}</span>}
        </button>
      </div>
    </aside>
  );
}

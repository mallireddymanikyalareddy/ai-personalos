import type { LucideIcon } from "lucide-react";

import {
  AREAS,
  MORE_AREAS,
  PRIMARY_AREAS,
  SYSTEM_AREAS,
  moreGroups,
  type AreaRoute,
} from "@/lib/ia/routes";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "today" | "inbox";
  status?: AreaRoute["status"];
}

export interface NavSection {
  label: string;
  items: NavItem[];
  kind: "primary" | "group";
}

function toNavItem(area: AreaRoute): NavItem {
  return {
    href: area.slug,
    label: area.label,
    icon: area.icon,
    badge: area.badge,
    status: area.status,
  };
}

export const PRIMARY_NAV: NavItem[] = PRIMARY_AREAS.map(toNavItem);
export const MORE_NAV: NavItem[] = MORE_AREAS.map(toNavItem);

export const SETTINGS_NAV: NavItem = toNavItem(AREAS.settings);
export const DESIGN_NAV: NavItem = toNavItem(AREAS.styleguide);
export const INBOX_NAV: NavItem = toNavItem(AREAS.inbox);

export const PRIMARY_SECTION: NavSection = {
  label: "Primary",
  items: PRIMARY_NAV,
  kind: "primary",
};

export const SIDEBAR_SECTIONS: NavSection[] = [
  PRIMARY_SECTION,
  ...moreGroups().map((group) => ({
    label: group.group,
    items: group.areas.map(toNavItem),
    kind: "group" as const,
  })),
];

export const NAV_SECTIONS: NavSection[] = [
  { label: "Main", items: PRIMARY_NAV, kind: "primary" },
  { label: "More", items: MORE_NAV, kind: "group" },
];

export const ALL_NAV_ITEMS: NavItem[] = [...PRIMARY_NAV, ...MORE_NAV, ...SYSTEM_AREAS.map(toNavItem)];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  toNavItem(AREAS.today),
  toNavItem(AREAS.calendar),
  toNavItem(AREAS.tasks),
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
export const SIDEBAR_STORAGE_KEY = "pos_sidebar_collapsed";

export const SIDEBAR_WIDTH_EXPANDED = "16rem";
export const SIDEBAR_WIDTH_COLLAPSED = "4rem";
export const SIDEBAR_COLLAPSE_BREAKPOINT = 1024;

export function isSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    return window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT;
  }
  return window.innerWidth < SIDEBAR_COLLAPSE_BREAKPOINT;
}

export function applySidebarDensity(collapsed: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.sidebar = collapsed ? "collapsed" : "expanded";
  root.style.setProperty(
    "--sidebar-w",
    collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
  );
}

export function persistSidebarDensity(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    return;
  }
  applySidebarDensity(collapsed);
}

export const SIDEBAR_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  SIDEBAR_STORAGE_KEY,
)};var s=window.localStorage.getItem(k);var c=s==="1"?true:s==="0"?false:window.innerWidth<${SIDEBAR_COLLAPSE_BREAKPOINT};var r=document.documentElement;r.dataset.sidebar=c?"collapsed":"expanded";r.style.setProperty("--sidebar-w",c?${JSON.stringify(
  SIDEBAR_WIDTH_COLLAPSED,
)}:${JSON.stringify(SIDEBAR_WIDTH_EXPANDED)});}catch(e){}})();`;
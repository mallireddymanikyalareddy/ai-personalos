"use client";

import * as React from "react";

interface CommandsValue {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

const CommandsContext = React.createContext<CommandsValue | null>(null);

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  const value = React.useMemo<CommandsValue>(() => {
    const openOne = (which: "palette" | "search") => {
      setPaletteOpen(which === "palette");
      setSearchOpen(which === "search");
    };
    return {
      paletteOpen,
      openPalette: () => openOne("palette"),
      closePalette: () => setPaletteOpen(false),
      togglePalette: () => {
        setSearchOpen(false);
        setPaletteOpen((current) => !current);
      },
      searchOpen,
      openSearch: () => openOne("search"),
      closeSearch: () => setSearchOpen(false),
      toggleSearch: () => {
        setPaletteOpen(false);
        setSearchOpen((current) => !current);
      },
    };
  }, [paletteOpen, searchOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "p") {
        event.preventDefault();
        value.togglePalette();
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        value.togglePalette();
        return;
      }
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        value.toggleSearch();
        return;
      }
      if (meta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        value.toggleSearch();
        return;
      }
      if (event.key === "/" && !isEditable(event.target)) {
        event.preventDefault();
        value.toggleSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [value]);

  return <CommandsContext.Provider value={value}>{children}</CommandsContext.Provider>;
}

export function useCommands(): CommandsValue {
  const context = React.useContext(CommandsContext);
  if (!context) throw new Error("useCommands must be used within CommandProvider");
  return context;
}
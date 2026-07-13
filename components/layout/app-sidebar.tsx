"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppBrand } from "@/components/layout/app-brand";
import {
  AppNavigationList,
  type FeatureAccessMap,
} from "@/components/layout/app-navigation-list";

const STORAGE_KEY = "sx-sidebar-collapsed";

export function AppSidebar({
  featureAccess,
}: {
  featureAccess: FeatureAccessMap;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      localStorage.setItem(STORAGE_KEY, current ? "0" : "1");
      return !current;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none lg:flex",
        collapsed ? "w-[4.5rem]" : "w-60"
      )}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <div className="flex h-[3.25rem] items-center border-b border-sidebar-border px-3">
        <AppBrand collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto py-3">
        <AppNavigationList
          collapsed={collapsed}
          featureAccess={featureAccess}
        />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon-sm" : "sm"}
          onClick={toggleCollapsed}
          className={cn(
            "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "mx-auto flex" : "w-full justify-start"
          )}
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          aria-pressed={collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed ? <span>Navigation einklappen</span> : null}
        </Button>
      </div>
    </aside>
  );
}

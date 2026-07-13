"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AppBrand } from "@/components/layout/app-brand";
import {
  AppNavigationList,
  type FeatureAccessMap,
} from "@/components/layout/app-navigation-list";

export function MobileAppNavigation({
  featureAccess,
}: {
  featureAccess: FeatureAccessMap;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Navigation öffnen">
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[min(20rem,88vw)] gap-0 bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs">
          <SheetHeader className="border-b border-sidebar-border px-4 py-3 pr-12 text-left">
            <SheetTitle className="sr-only">App-Navigation</SheetTitle>
            <SheetDescription className="sr-only">Bereiche der StorageX Handelskonsole</SheetDescription>
            <AppBrand />
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            <AppNavigationList
              featureAccess={featureAccess}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingExpenseDialog } from "@/components/dialogs/marketing-expense-dialog";

export function AddMarketingExpenseButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Megaphone className="h-4 w-4" /> Record marketing expense
      </Button>
      <MarketingExpenseDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

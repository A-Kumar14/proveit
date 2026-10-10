"use client";

import { useClerk } from "@clerk/nextjs";
import { LogOut, Settings } from "lucide-react";
import { buttonStyles } from "../Button";
import { cn } from "@proveit/lib/cn";

/** Manage account and sign out. Only mounted when accounts are on, since it needs the Clerk provider. */
export function AccountActions() {
  const clerk = useClerk();
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => clerk.openUserProfile()} className={cn(buttonStyles({ variant: "secondary" }), "cursor-pointer")}><Settings size={14} aria-hidden />Manage account</button>
      <button type="button" onClick={() => void clerk.signOut({ redirectUrl: "/sign-in" })} className={cn(buttonStyles(), "cursor-pointer")}><LogOut size={14} aria-hidden />Sign out</button>
    </div>
  );
}

import { LogOut } from "lucide-react";

import { buttonStyles } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout} className={className}>
      <button type="submit" className={buttonStyles({ variant: "ghost", size: "sm" })}>
        <LogOut aria-hidden />
        Sair
      </button>
    </form>
  );
}

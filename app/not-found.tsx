import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço pode ter mudado ou o lead não existe mais."
        action={
          <Link href="/" className={buttonStyles({ variant: "primary" })}>
            Voltar para o início
          </Link>
        }
      />
    </div>
  );
}

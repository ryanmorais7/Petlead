"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { PageContainer } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type ErrorPageProps = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Technical details stay in the console; the seller only sees a friendly message.
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={TriangleAlert}
        title="Não foi possível carregar esta tela"
        description="Aconteceu um problema do nosso lado. Seus dados estão seguros. Tente novamente em instantes."
        action={
          <Button variant="primary" onClick={reset}>
            <RotateCcw aria-hidden />
            Tentar novamente
          </Button>
        }
      />
    </PageContainer>
  );
}

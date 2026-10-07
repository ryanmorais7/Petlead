import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer, PageHeader } from "@/components/layout/page";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Novo lead" };

export default function NewLeadPage() {
  return (
    <PageContainer className="max-w-2xl">
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Leads
      </Link>
      <PageHeader
        title="Novo lead"
        description="Cadastre um contato que ainda não conversou pelo WhatsApp conectado."
      />
      <Card className="p-4 sm:p-6">
        <NewLeadForm />
      </Card>
    </PageContainer>
  );
}

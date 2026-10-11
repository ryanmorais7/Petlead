import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page";
import { LeadForm } from "@/components/leads/lead-form";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { updateLead } from "@/lib/actions/leads";
import { getLeadForEdit } from "@/lib/data/leads";
import { formatPhone } from "@/lib/format";
import { leadIdSchema } from "@/lib/validations/lead";

export const metadata: Metadata = { title: "Editar lead" };

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/editar">) {
  return (
    <PageContainer className="max-w-2xl">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <EditLead params={params} />
      </Suspense>
    </PageContainer>
  );
}

async function EditLead({ params }: { params: PageProps<"/leads/[id]/editar">["params"] }) {
  const { id } = await params;
  const parsedId = leadIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const lead = await getLeadForEdit(parsedId.data);
  if (!lead) notFound();

  const profileHref = `/leads/${lead.id}`;

  return (
    <>
      <Link
        href={profileHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {lead.name}
      </Link>
      <PageHeader title="Editar lead" />
      <Card className="p-4 sm:p-6">
        <LeadForm
          // The lead id is fixed on the server: the browser cannot point the form at another lead.
          action={updateLead.bind(null, lead.id)}
          initialValues={{
            name: lead.name,
            phone: formatPhone(lead.phone),
            email: lead.email ?? "",
            source: lead.source,
            petCount: lead.petCount === null ? "" : String(lead.petCount),
            petNames: lead.petNames.join(", "),
            planInterest: lead.planInterest ?? "",
            mainObjection: lead.mainObjection ?? "",
            notes: lead.notes ?? "",
          }}
          submitLabel="Salvar alterações"
          cancelHref={profileHref}
        />
      </Card>
    </>
  );
}

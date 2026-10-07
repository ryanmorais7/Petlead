import { PawPrint } from "lucide-react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-600 text-white">
            <PawPrint className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">PetLead</h1>
          <p className="mt-1 text-sm text-zinc-500">Entre para ver quem chamar hoje.</p>
        </div>
        <Card className="p-5 sm:p-6">
          <LoginForm />
        </Card>
      </div>
    </main>
  );
}

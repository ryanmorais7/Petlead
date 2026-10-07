import { Info } from "lucide-react";

/** Reminds the seller that the screens still run on fictitious data. */
export function DemoNotice() {
  return (
    <p className="mb-5 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
      <Info className="mt-0.5 size-3.5 shrink-0 text-zinc-400" aria-hidden />
      <span>
        Dados de demonstração. O envio de mensagens e as alterações nos leads serão habilitados
        quando o banco de dados e o WhatsApp forem conectados.
      </span>
    </p>
  );
}

import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useResolveShortCode } from "@/hooks/agenda/usePublicBooking";
import PublicBooking from "./PublicBooking";

// Wrapper para URLs cortas /v/:code. Resuelve el código a su public_token y
// delega al componente PublicBooking ya existente. Mantiene la URL `/v/<code>`
// visible en la barra del navegador.
export default function PublicBookingByCode() {
  const { code } = useParams<{ code: string }>();
  const resolveQ = useResolveShortCode(code);

  // Mientras resuelve, mostramos el mismo spinner que el flujo /agendar/:token
  // (cohesivo visualmente, evita parpadeos).
  if (resolveQ.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
            Validando link...
          </span>
        </div>
      </div>
    );
  }

  // Si el código no resuelve a un token válido (vencido / inválido / ya
  // agendado), pasamos token=undefined → PublicBooking cae en el InvalidLinkCard.
  return <PublicBooking token={resolveQ.data ?? undefined} />;
}

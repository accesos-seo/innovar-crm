import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { es } from "date-fns/locale";
import {
  LifeBuoy,
  ClipboardList,
  Send,
  Clock,
  CheckCircle2,
  Circle,
  MessageSquare,
  User,
} from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { notify } from "@/components/ui/PremiumToast";
import type { SupportTicket, TicketMessage, TicketStatus } from "@/types/tickets";
import { PRIORITY_LABELS, CATEGORY_LABELS } from "@/types/tickets";

function safeFormat(dateStr: string, fmt: string): string {
  const d = new Date(dateStr);
  return isValid(d) ? format(d, fmt, { locale: es }) : "—";
}

const PRIORITY_COLORS: Record<string, string> = {
  baja: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  media: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  alta: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  urgente: "text-red-400 bg-red-400/10 border-red-400/20",
};

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  Abierto: {
    label: "Abierto",
    icon: Circle,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  "En Progreso": {
    label: "En Progreso",
    icon: Clock,
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  Cerrado: {
    label: "Cerrado",
    icon: CheckCircle2,
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  },
};

export default function TicketDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const isAdmin =
    profile?.role === "admin" || profile?.role === "super_admin";
  const [reply, setReply] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ["support_ticket", id],
    queryFn: async () => {
      if (!id) throw new Error("ID requerido");
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, creator:profiles!created_by(full_name, avatar_url, role)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as SupportTicket;
    },
    enabled: !!id,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["ticket_messages", id],
    queryFn: async () => {
      if (!id) throw new Error("ID requerido");
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*, sender:profiles!sender_id(full_name, avatar_url, role)")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketMessage[];
    },
    enabled: !!id,
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const replyMutation = useMutation({
    mutationFn: async ({
      content,
      ticketStatus,
      ticketFirstResponse,
    }: {
      content: string;
      ticketStatus: TicketStatus;
      ticketFirstResponse: string | null;
    }) => {
      if (!profile?.id) throw new Error("No hay sesión activa");
      if (!id) throw new Error("ID de ticket requerido");

      const { error: msgError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: Number(id),
          sender_id: profile.id,
          content,
          is_internal: false,
        });
      if (msgError) throw msgError;

      // Admin: actualizar estado y first_response_at usando parámetros snapshot
      if (isAdmin) {
        const updates: Record<string, unknown> = {};
        if (!ticketFirstResponse) {
          updates.first_response_at = new Date().toISOString();
        }
        if (ticketStatus === "Abierto") {
          updates.status = "En Progreso";
        }
        if (Object.keys(updates).length > 0) {
          const { error: upErr } = await supabase
            .from("support_tickets")
            .update(updates)
            .eq("id", id);
          if (upErr) console.warn("[ticket-reply] update status:", upErr.message);
        }
      }
    },
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["ticket_messages", id] });
      queryClient.invalidateQueries({ queryKey: ["support_ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
      notify.success("Mensaje enviado");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      notify.error("Error al enviar", msg);
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async (newStatus: TicketStatus) => {
      if (!id) throw new Error("ID de ticket requerido");
      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === "Cerrado") updates.closed_at = new Date().toISOString();
      const { error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ["support_ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
      queryClient.invalidateQueries({ queryKey: ["mis_solicitudes"] });
      notify.success(`Estado actualizado: ${newStatus}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      notify.error("Error al actualizar estado", msg);
    },
  });

  const handleSend = () => {
    const content = reply.trim();
    if (!content || !ticket) return;
    replyMutation.mutate({
      content,
      ticketStatus: ticket.status,
      ticketFirstResponse: ticket.first_response_at,
    });
  };

  if (ticketLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto w-full py-20 text-center space-y-4">
        <p className="text-muted-foreground">Ticket no encontrado.</p>
        <Button variant="link" onClick={() => navigate("/soporte")}>
          Volver a Soporte
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG["Abierto"];
  const StatusIcon = statusConfig.icon;
  const canReply = ticket.status !== "Cerrado" || isAdmin;

  // Una "solicitud" la envía el equipo al cliente: solo su creador (el técnico)
  // gestiona el estado; el cliente únicamente responde en la conversación.
  const isSolicitud = ticket.ticket_type === "solicitud";
  const noun = isSolicitud ? "Solicitud" : "Ticket";
  const canManageStatus = isSolicitud
    ? profile?.id === ticket.created_by
    : isAdmin;
  const backPath = isSolicitud ? "/soporte/mis-solicitudes" : "/soporte";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto w-full space-y-6 pb-20"
    >
      <CategoryHeader
        title={`${noun.toUpperCase()} ${ticket.ticket_id}`}
        subtitle={ticket.subject}
        icon={isSolicitud ? ClipboardList : LifeBuoy}
        onBack={() => navigate(backPath)}
      />

      {/* Ticket metadata */}
      <div className="bg-card border border-border/10 rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
              statusConfig.color
            )}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
          <span
            className={cn(
              "text-xs font-bold px-3 py-1.5 rounded-full border",
              PRIORITY_COLORS[ticket.priority] ?? "text-muted-foreground bg-muted/30"
            )}
          >
            {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
          </span>
          <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/20">
            {CATEGORY_LABELS[ticket.category] ?? ticket.category}
          </span>
          {isAdmin && ticket.creator && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="w-3 h-3" />
              {ticket.creator.full_name}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {safeFormat(ticket.created_at, "d 'de' MMMM, yyyy")}
          </span>
        </div>

        {ticket.description && (
          <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/5 pt-4 whitespace-pre-line">
            {ticket.description}
          </p>
        )}

        {/* Gestión de estado: tickets → admins; solicitudes → solo su creador */}
        {canManageStatus && ticket.status !== "Cerrado" && (
          <div className="border-t border-border/5 pt-4 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
              Cambiar estado
            </p>
            <div className="flex flex-wrap gap-2">
              {ticket.status === "Abierto" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeStatusMutation.mutate("En Progreso")}
                  disabled={changeStatusMutation.isPending}
                  className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Marcar En Progreso
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => changeStatusMutation.mutate("Cerrado")}
                disabled={changeStatusMutation.isPending}
                className="text-emerald-400 border-emerald-400/30 hover:bg-emerald-400/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Cerrar {noun}
              </Button>
            </div>
          </div>
        )}

        {canManageStatus && ticket.status === "Cerrado" && (
          <div className="border-t border-border/5 pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => changeStatusMutation.mutate("Abierto")}
              disabled={changeStatusMutation.isPending}
            >
              Reabrir {noun}
            </Button>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-black text-muted-foreground/60 uppercase tracking-widest">
            Conversación ({messages.length})
          </h3>
        </div>

        {messagesLoading ? (
          <div className="bg-card border border-border/10 rounded-lg h-24 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="bg-card border border-border/10 rounded-lg py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay mensajes. Sé el primero en escribir.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border/10 rounded-lg p-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                currentUserId={profile?.id ?? ""}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply box */}
      {canReply ? (
        <div className="bg-card border border-border/10 rounded-lg p-4 space-y-3">
          <Textarea
            placeholder="Escribe tu mensaje… (Ctrl+Enter para enviar)"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            className="rounded-none border-border/50 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend();
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/40">
              Ctrl + Enter para enviar
            </p>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!reply.trim() || replyMutation.isPending}
              className="h-9"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {replyMutation.isPending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground py-4 bg-card border border-border/10 rounded-lg">
          {isSolicitud
            ? "Esta solicitud está cerrada. Contacta al equipo si necesitas reactivarla."
            : "Este ticket está cerrado. Contacta al equipo si necesitas reactivarlo."}
        </p>
      )}
    </motion.div>
  );
}

function MessageBubble({
  message,
  currentUserId,
}: {
  message: TicketMessage;
  currentUserId: string;
}) {
  const isOwn = message.sender_id === currentUserId;
  const senderName = message.sender?.full_name ?? "Usuario";
  const senderRole = message.sender?.role ?? "";
  const isTeam = senderRole === "admin" || senderRole === "super_admin";

  return (
    <div className={cn("flex gap-3", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5",
          isTeam
            ? "bg-primary/20 text-primary"
            : "bg-muted/50 text-muted-foreground"
        )}
      >
        {senderName.charAt(0).toUpperCase()}
      </div>
      <div
        className={cn(
          "max-w-[75%] space-y-1",
          isOwn && "flex flex-col items-end"
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-bold",
              isTeam ? "text-primary" : "text-muted-foreground"
            )}
          >
            {isTeam ? `${senderName} (equipo)` : senderName}
          </span>
          <span className="text-[10px] text-muted-foreground/40">
            {safeFormat(message.created_at, "d MMM HH:mm")}
          </span>
        </div>
        <div
          className={cn(
            "rounded-lg p-3 text-sm leading-relaxed",
            isOwn
              ? "bg-primary/10 text-foreground border border-primary/20 rounded-tr-none"
              : "bg-muted/30 text-foreground border border-border/10 rounded-tl-none"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

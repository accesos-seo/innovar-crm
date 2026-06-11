import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";
import { notify } from "@/components/ui/PremiumToast";
import type { TicketPriority, TicketCategory } from "@/types/tickets";

interface FormData {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "soporte-tecnico", label: "🛠️ Soporte Técnico" },
  { value: "consulta-general", label: "💬 Consulta General" },
  { value: "reportar-problema", label: "🐛 Reportar Problema" },
  { value: "solicitud-mejora", label: "✨ Solicitud de Mejora" },
  { value: "otro", label: "📁 Otro" },
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "baja", label: "🔵 Baja" },
  { value: "media", label: "🟡 Media" },
  { value: "alta", label: "🔥 Alta" },
  { value: "urgente", label: "🚨 Urgente" },
];

export default function NuevoTicketPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: { category: "consulta-general", priority: "media" },
  });

  const categoryValue = watch("category");
  const priorityValue = watch("priority");

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!profile?.id) throw new Error("No hay sesión activa");
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          subject: data.subject.trim(),
          description: data.description?.trim() || null,
          category: data.category,
          priority: data.priority,
          status: "Abierto",
          created_by: profile.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Notificar por email (non-blocking)
      supabase.functions
        .invoke("ticket-created", {
          body: { ticket_id: ticket.id, ticket_ref: ticket.ticket_id },
        })
        .catch(() => {});

      return ticket;
    },
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
      notify.success(
        "Ticket enviado",
        `${ticket.ticket_id} recibido. Te notificaremos al responder.`
      );
      navigate(`/soporte/${ticket.id}`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Intenta nuevamente.";
      notify.error("Error al crear ticket", msg);
    },
  });

  const onSubmit = (data: FormData) => {
    if (!data.subject?.trim()) return;
    createMutation.mutate(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-2xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader
        title="NUEVO TICKET"
        subtitle="Describe tu solicitud o problema con el mayor detalle posible."
        icon={LifeBuoy}
        onBack={() => navigate("/soporte")}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-card border border-border/10 rounded-lg p-6 space-y-5">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-medium">
              Asunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Ej: No puedo acceder al módulo de pagos"
              {...register("subject", {
                required: "El asunto es obligatorio",
                minLength: { value: 5, message: "Mínimo 5 caracteres" },
              })}
              className={cn(
                "h-12 rounded-none border-border/50",
                errors.subject && "border-destructive"
              )}
            />
            {errors.subject && (
              <p className="text-xs text-destructive">{errors.subject.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descripción{" "}
              <span className="text-muted-foreground/60 font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Describe el problema en detalle: qué sucedió, cuándo empezó, pasos para reproducirlo…"
              rows={5}
              {...register("description")}
              className="rounded-none border-border/50 resize-none"
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Categoría <span className="text-destructive">*</span>
              </Label>
              <Select
                value={categoryValue}
                onValueChange={(val) =>
                  setValue("category", val as TicketCategory)
                }
              >
                <SelectTrigger className="h-12 rounded-none border-border/50">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Prioridad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={priorityValue}
                onValueChange={(val) =>
                  setValue("priority", val as TicketPriority)
                }
              >
                <SelectTrigger className="h-12 rounded-none border-border/50">
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <PrimaryButton
          type="submit"
          label={createMutation.isPending ? "Enviando…" : "Enviar Ticket"}
          icon={Send}
          disabled={createMutation.isPending}
          className="w-full h-14"
        />
      </form>
    </motion.div>
  );
}

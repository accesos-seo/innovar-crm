import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Send, Paperclip, Link2, X, Upload, Loader2 } from "lucide-react";
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

interface Attachment {
  name: string;
  url: string;
  kind: "file" | "url";
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "soporte-tecnico",   label: "🛠️  Soporte Técnico" },
  { value: "consulta-general",  label: "💬  Consulta General" },
  { value: "reportar-problema", label: "🐛  Reportar Problema" },
  { value: "solicitud-mejora",  label: "✨  Solicitud de Mejora" },
  { value: "otro",              label: "📁  Otro" },
];

const PRIORITIES: { value: TicketPriority; label: string }[] = [
  { value: "baja",    label: "🔵  Baja" },
  { value: "media",   label: "🟡  Media" },
  { value: "alta",    label: "🔥  Alta" },
  { value: "urgente", label: "🚨  Urgente" },
];

export default function NuevoTicketPage() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [urlInput, setUrlInput] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

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

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setAttachments((prev) => [...prev, { name: url, url, kind: "url" }]);
    setUrlInput("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { upsert: false });
      if (error) {
        notify.error("Error al subir archivo", file.name);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(path);
      setAttachments((prev) => [
        ...prev,
        { name: file.name, url: urlData.publicUrl, kind: "file" },
      ]);
    }
    setUploading(false);
    // Reset file input so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!profile?.id) throw new Error("No hay sesión activa");
      if (!data.subject?.trim()) throw new Error("El asunto es obligatorio");
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          subject: data.subject.trim(),
          description: data.description?.trim() || null,
          category: data.category,
          priority: data.priority,
          status: "Abierto",
          ticket_type: "ticket",
          created_by: profile.id,
          file_urls: attachments.map((a) => a.url),
        })
        .select()
        .single();
      if (error) throw error;

      supabase.functions
        .invoke("ticket-created", {
          body: { ticket_id: ticket.id, ticket_ref: ticket.ticket_id },
        })
        .catch((e) => console.warn("[ticket-created] invoke failed:", e));

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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
                onValueChange={(val) => setValue("category", val as TicketCategory)}
              >
                <SelectTrigger className="h-12 rounded-none border-border/50 w-full">
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent
                  className="w-[var(--radix-select-trigger-width)] min-w-[220px]"
                  position="popper"
                  sideOffset={4}
                >
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="py-3">
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
                onValueChange={(val) => setValue("priority", val as TicketPriority)}
              >
                <SelectTrigger className="h-12 rounded-none border-border/50 w-full">
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent
                  className="w-[var(--radix-select-trigger-width)] min-w-[180px]"
                  position="popper"
                  sideOffset={4}
                >
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="py-3">
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-card border border-border/10 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Archivos adjuntos</span>
            <span className="text-xs text-muted-foreground/60 font-normal ml-1">(opcional)</span>
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())}
                placeholder="Pega una URL (Google Drive, Dropbox, imagen…)"
                className="h-12 rounded-none border-border/50 pl-9 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={addUrl}
              disabled={!urlInput.trim()}
              className={cn(
                "h-12 px-4 text-xs font-bold uppercase tracking-widest rounded-none border transition-colors",
                urlInput.trim()
                  ? "border-primary/40 text-primary hover:bg-primary/5"
                  : "border-border/20 text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              Agregar
            </button>
          </div>

          {/* File upload area */}
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              "border border-dashed border-border/30 rounded-md p-5 text-center transition-colors cursor-pointer",
              uploading ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:bg-primary/2"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Subiendo archivo…</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground/60">
                  Haz clic o arrastra archivos aquí
                </p>
                <p className="text-[10px] text-muted-foreground/40">
                  PDF, imágenes, Word, Excel, ZIP — máx. 10 MB
                </p>
              </div>
            )}
          </div>

          {/* Attachment list */}
          {attachments.length > 0 && (
            <ul className="space-y-2">
              {attachments.map((att, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-md border border-border/10"
                >
                  {att.kind === "url" ? (
                    <Link2 className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5 text-emerald-400/70 shrink-0" />
                  )}
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors truncate flex-1"
                  >
                    {att.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <PrimaryButton
          type="submit"
          label={createMutation.isPending ? "Enviando…" : "Enviar Ticket"}
          icon={Send}
          disabled={createMutation.isPending || uploading}
          className="w-full h-14"
        />
      </form>
    </motion.div>
  );
}

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { assertSupabase, mapSupabaseError } from "@/lib/errors";
import { formatSentenceCase, formatPersonName } from "@/lib/format-utils";
import { useReassignOpportunity } from "@/hooks/useReassignOpportunity";

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  currentAssigneeId: string | null;
}

interface ProfileOption {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  comercial: "Comercial",
};

function profileDisplayName(p: ProfileOption): string {
  const name = formatPersonName(p.full_name || p.email, "Usuario sin nombre");
  const role = ROLE_LABELS[p.role] ?? formatSentenceCase(p.role);
  return `${name} · ${role}`;
}

function useActiveComerciales() {
  return useQuery<ProfileOption[]>({
    queryKey: ["profiles", "comercial-active"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      assertSupabase(supabase);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active")
        .in("role", ["comercial", "admin", "super_admin"])
        .eq("is_active", true)
        .order("full_name", { ascending: true });
      if (error) throw mapSupabaseError(error);
      return (data || []) as ProfileOption[];
    },
  });
}

export function ReassignDialog({
  open,
  onOpenChange,
  opportunityId,
  currentAssigneeId,
}: ReassignDialogProps) {
  const { data: profiles = [], isLoading } = useActiveComerciales();
  const reassign = useReassignOpportunity();
  const [selected, setSelected] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");

  React.useEffect(() => {
    if (open) {
      setSelected(currentAssigneeId ?? "");
      setReason("");
    }
  }, [open, currentAssigneeId]);

  const handleSubmit = async () => {
    if (!selected) return;
    await reassign.mutateAsync({
      opportunityId,
      newAssigneeId: selected,
      reason: reason.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {formatSentenceCase("Reasignar oportunidad")}
          </DialogTitle>
          <DialogDescription>
            {formatSentenceCase(
              "Elige el nuevo responsable. El cambio queda registrado en el historial.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {formatSentenceCase("Comercial")}
            </label>
            <Select
              value={selected}
              onValueChange={(v) => setSelected(v ?? "")}
            >
              <SelectTrigger className="w-full !h-12 px-4 rounded-none border border-border/50 bg-background text-sm font-bold">
                <span className="truncate flex-1 text-left">
                  {(() => {
                    if (isLoading) {
                      return (
                        <span className="text-muted-foreground/60 font-normal italic">
                          {formatSentenceCase("Cargando...")}
                        </span>
                      );
                    }
                    const current = profiles.find((p) => p.id === selected);
                    if (!current) {
                      return (
                        <span className="text-muted-foreground/60 font-normal italic">
                          {formatSentenceCase("Selecciona un comercial")}
                        </span>
                      );
                    }
                    return profileDisplayName(current);
                  })()}
                </span>
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {profileDisplayName(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {formatSentenceCase("Motivo (opcional)")}
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={formatSentenceCase(
                "Ej. Vacaciones, balanceo de carga, especialidad técnica...",
              )}
              rows={3}
              className="rounded-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={reassign.isPending}
          >
            {formatSentenceCase("Cancelar")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selected ||
              selected === currentAssigneeId ||
              reassign.isPending
            }
          >
            {reassign.isPending
              ? formatSentenceCase("Reasignando...")
              : formatSentenceCase("Confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Plus, UserCog, ArrowRightLeft } from "lucide-react";
import { formatSentenceCase } from "@/lib/format-utils";
import { useOpportunityTransition } from "@/hooks/useOpportunityTransition";
import {
  OPPORTUNITY_STATUSES,
  opportunityStatusConfig,
  type OpportunityStatus,
} from "@/schemas/opportunity";
import { useNavigate } from "react-router-dom";

interface OpportunityActionsProps {
  opportunityId: string;
  currentStatus: OpportunityStatus;
  clientId: string | null;
  onReassign: () => void;
}

export function OpportunityActions({
  opportunityId,
  currentStatus,
  clientId,
  onReassign,
}: OpportunityActionsProps) {
  const navigate = useNavigate();
  const transition = useOpportunityTransition();
  const [pendingStatus, setPendingStatus] = React.useState<OpportunityStatus>(
    currentStatus,
  );

  React.useEffect(() => {
    setPendingStatus(currentStatus);
  }, [currentStatus]);

  const handleStatusChange = async (newStatus: string | null) => {
    if (!newStatus) return;
    const next = newStatus as OpportunityStatus;
    setPendingStatus(next);
    if (next !== currentStatus) {
      await transition.mutateAsync({
        opportunityId,
        newStatus: next,
        lostReason: null,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Select value={pendingStatus} onValueChange={handleStatusChange}>
        <SelectTrigger
          aria-label={formatSentenceCase("Cambiar estado")}
          className="w-full !h-12 px-4 rounded-none gap-2 text-sm font-bold border border-border/50 bg-background hover:border-primary/40 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate flex-1 text-left">
            {formatSentenceCase(opportunityStatusConfig[pendingStatus]?.label ?? pendingStatus)}
          </span>
        </SelectTrigger>
        <SelectContent>
          {OPPORTUNITY_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {formatSentenceCase(opportunityStatusConfig[s].label)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        className="h-12 rounded-none gap-2"
        onClick={onReassign}
      >
        <UserCog className="w-4 h-4" />
        {formatSentenceCase("Reasignar comercial")}
      </Button>

      <Button
        className="h-12 rounded-none gap-2"
        onClick={() => {
          if (!clientId) return;
          navigate(`/quotations/new?client_id=${clientId}&opportunity_id=${opportunityId}`);
        }}
        disabled={!clientId}
      >
        <Plus className="w-4 h-4" />
        {formatSentenceCase("Generar cotización")}
      </Button>
    </div>
  );
}

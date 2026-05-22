import * as React from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatSentenceCase } from "@/lib/format-utils";
import {
  opportunityStatusConfig,
  type OpportunityStatus,
} from "@/schemas/opportunity";

export function OpportunityStatusBadge({
  status,
  animate = "scale",
}: {
  status: OpportunityStatus;
  animate?: "scale" | "pulse" | "none";
}) {
  const config = opportunityStatusConfig[status] || opportunityStatusConfig.new;
  return (
    <StatusBadge variant={config.variant} dot animate={animate}>
      {formatSentenceCase(config.label)}
    </StatusBadge>
  );
}

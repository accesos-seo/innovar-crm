import * as React from "react";
import { FEATURES } from "@/lib/features";
import LeadsLegacy from "./leads/LeadsLegacy";
import LeadsOpportunities from "./leads/LeadsOpportunities";

// Cutover Slice 2 (Lead→Project flow).
// FEATURES.opportunitiesEnabled = VITE_FF_OPPORTUNITIES === 'true' en .env.
// Mientras el flag esté OFF, la app usa la vista vieja basada en `clients`.
export default function Leads() {
  return FEATURES.opportunitiesEnabled ? <LeadsOpportunities /> : <LeadsLegacy />;
}

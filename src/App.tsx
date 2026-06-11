import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useAuthStore } from "./store/authStore";
import { Layout } from "./components/layout/Layout";
import { PremiumToaster, notify } from "@/components/ui/PremiumToast";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "./components/shared/ScrollToTop";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import { FEATURES } from "@/lib/features";
import { ConnectionBanner } from "./components/shared/ConnectionBanner";
import { supabase } from "@/lib/supabaseClient";

// Static imports (critical path -- always needed)
import LoginPage from "./pages/Login";
import ResetPasswordPage from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";

// Lazy imports (loaded only when the route is visited)
const Dashboard             = lazy(() => import("./pages/Dashboard"));
const ProjectsPage          = lazy(() => import("./pages/Projects"));
const ProjectCreatePage     = lazy(() => import("./pages/ProjectCreate"));
const ProjectDetailPage     = lazy(() => import("./pages/ProjectDetail"));
const ClientsPage           = lazy(() => import("./pages/Clients"));
const LeadsPage             = lazy(() => import("./pages/Leads"));
const LeadCreatePage        = lazy(() => import("./pages/LeadCreate"));
const InventoryPage         = lazy(() => import("./pages/Inventory"));
const InventoryCreatePage   = lazy(() => import("./pages/InventoryCreate"));
const ProfilePage           = lazy(() => import("./pages/Profile"));
const SettingsPage          = lazy(() => import("./pages/Settings"));
const AgendaPage            = lazy(() => import("./pages/Agenda"));
const ReunionesPage         = lazy(() => import("./pages/Reuniones"));
const MyDayPage             = lazy(() => import("./pages/MyDay"));
const NotificationsPage     = lazy(() => import("./pages/Notifications"));
const TareasPage            = lazy(() => import("./pages/Tareas"));
const PagosPage             = lazy(() => import("./pages/Pagos"));
const GastosPage            = lazy(() => import("./pages/Gastos"));
const CierresContablesPage  = lazy(() => import("./pages/CierresContables"));
const QuotationsPage        = lazy(() => import("./pages/Quotations"));
const QuotationCreatePage   = lazy(() => import("./pages/QuotationCreate"));
const QuotationDetailPage   = lazy(() => import("./pages/QuotationDetail"));
const UsersSettingsPage     = lazy(() => import("./pages/settings/Users"));
const UserCreatePage        = lazy(() => import("./pages/UserCreate"));
const AuditSettingsPage     = lazy(() => import("./pages/settings/Audit"));
const WhatsAppSettingsPage  = lazy(() => import("./pages/settings/WhatsApp"));
const MaterialsSettingsPage = lazy(() => import("./pages/settings/Materials"));
const MaterialCreatePage    = lazy(() => import("./pages/MaterialCreate"));
const PricingSettingsPage   = lazy(() => import("./pages/settings/Pricing"));
const PricingCreatePage     = lazy(() => import("./pages/PricingCreate"));
const HolidaysSettingsPage  = lazy(() => import("./pages/settings/Holidays"));
const HolidayCreatePage     = lazy(() => import("./pages/HolidayCreate"));
const BankSettingsPage      = lazy(() => import("./pages/settings/BankSettings"));
const PaymentSettingsPage   = lazy(() => import("./pages/settings/PaymentSettings"));
const ParametersSettingsPage    = lazy(() => import("./pages/settings/Parameters"));
const NotificationsSettingsPage = lazy(() => import("./pages/settings/Notifications"));
const MaintenanceSettingsPage   = lazy(() => import("./pages/settings/Maintenance"));
const DictionaryPage        = lazy(() => import("./pages/Dictionary"));
const MotorComercialPage             = lazy(() => import("./pages/MotorComercial"));
const AgentesPage                    = lazy(() => import("./pages/Agentes"));
const SeguimientoCotizacionesPage    = lazy(() => import("./pages/SeguimientoCotizaciones"));
const AgentDetailPage                = lazy(() => import("./pages/agentes/AgentDetailPage"));
const Debugger              = lazy(() => import("./pages/Debugger"));
const NotFoundPage          = lazy(() => import("./pages/NotFound"));
const PublicBookingPage     = lazy(() => import("./pages/PublicBooking"));
const PublicBookingByCodePage = lazy(() => import("./pages/PublicBookingByCode"));
const PublicQuotationPage   = lazy(() => import("./pages/PublicQuotation"));
const PublicQuotationByCodePage = lazy(() => import("./pages/PublicQuotationByCode"));
const PublicProjectTrackingPage = lazy(() => import("./pages/PublicProjectTracking"));
const DocsHomePage                   = lazy(() => import("./pages/docs/DocsHomePage"));
const DocsAutomatizacionesPage       = lazy(() => import("./pages/docs/DocsAutomatizacionesPage"));
const DocsAutomatizacionDetailPage   = lazy(() => import("./pages/docs/DocsAutomatizacionDetailPage"));
const DocsHabilidadesPage            = lazy(() => import("./pages/docs/DocsHabilidadesPage"));
const HorasPage                      = lazy(() => import("./pages/Horas"));
const ProduccionPage                 = lazy(() => import("./pages/Produccion"));
const ProduccionFichaPage            = lazy(() => import("./pages/ProduccionFicha"));
const PostventaPage                  = lazy(() => import("./pages/Postventa"));
const PublicSurveyPage               = lazy(() => import("./pages/PublicSurvey"));
const DecisionesPage                 = lazy(() => import("./pages/Decisiones"));
const DecisionDetailPage             = lazy(() => import("./pages/DecisionDetail"));
const SoportePage                    = lazy(() => import("./pages/Soporte"));
const NuevoTicketPage                = lazy(() => import("./pages/soporte/NuevoTicket"));
const TicketDetallePage              = lazy(() => import("./pages/soporte/TicketDetalle"));

// â"€â"€ Route-level loading fallback â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

const queryErrorCache = new QueryCache({
  onError: (error, query) => {
    const msg = (error as Error)?.message ?? String(error);
    const tableHint = JSON.stringify(query.queryKey).slice(0, 80);
    console.error(`[query-error] ${tableHint} â†' ${msg}`);
    if (/network|fetch/i.test(msg)) {
      notify.error(
        'Error de conexiÃ³n',
        `${msg.split('.')[0]}. Verifica tu conexiÃ³n a internet.`
      );
    }
  },
});

const queryClient = new QueryClient({
  queryCache: queryErrorCache,
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: 2000,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function Protected({ children, roles }: { children: React.ReactNode; roles?: any }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

// El rol produccion no usa el Dashboard: su home es el tablero de planta.
// Cubre todos los caminos de entrada (login email, Google, deep-link a "/").
function HomeForRole({ children }: { children: React.ReactNode }) {
  const profile = useAuthStore((s) => s.profile);
  if (FEATURES.productionModuleEnabled && profile?.role === "produccion") {
    return <Navigate to="/produccion" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    initializeAuth();

    if (!supabase) {
      notify.warning(
        "Modo DemostraciÃ³n Activo",
        "Supabase no estÃ¡ configurado. Se estÃ¡n usando datos locales de prueba."
      );
    }
  }, [initializeAuth]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* â"€â"€ Public routes â"€â"€ */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                {/* Link pÃºblico que el cliente recibe por WhatsApp para
                    agendar su visita tÃ©cnica. Sin ProtectedRoute, sin Layout. */}
                <Route path="/agendar/:token" element={<PublicBookingPage />} />
                {/* URL corta /v/:code â†' resuelve el short_code y reusa el flujo. */}
                <Route path="/v/:code" element={<PublicBookingByCodePage />} />
                {/* CotizaciÃ³n pÃºblica (Fase 4 Slice 2). Standalone, sin auth, sin Layout.
                    Si VITE_FF_PHASE_4_QUOTATION_PUBLIC=false la pÃ¡gina devuelve 404. */}
                <Route path="/cotizacion/:token" element={<PublicQuotationPage />} />
                {/* URL corta /c/:code â†' resuelve short_code y redirige al token largo. */}
                <Route path="/c/:code" element={<PublicQuotationByCodePage />} />
                {/* Portal del Cliente "Mi Proyecto" (migraciÃ³n 053). Standalone, sin auth.
                    Si VITE_FF_CLIENT_PORTAL=false la pÃ¡gina devuelve 404. */}
                <Route path="/proyecto/:token" element={<PublicProjectTrackingPage />} />
                {/* Encuesta de satisfacciÃ³n (migraciÃ³n 055). Standalone, sin auth.
                    Si VITE_FF_POSTVENTA=false la pÃ¡gina devuelve 404. */}
                <Route path="/encuesta/:token" element={<PublicSurveyPage />} />

                {/* â"€â"€ Dev/admin tooling â"€â"€ */}
                <Route
                  path="/debugger"
                  element={
                    <Protected roles={["admin", "super_admin"]}>
                      <Debugger />
                    </Protected>
                  }
                />

                {/* â"€â"€ Core app â"€â"€ */}
                <Route path="/" element={<Protected><HomeForRole><Dashboard /></HomeForRole></Protected>} />

                {/* ProducciÃ³n / Taller (migraciÃ³n 054). Si VITE_FF_PRODUCTION_MODULE=false
                    las rutas no se registran y caen en el 404. */}
                {FEATURES.productionModuleEnabled && (
                  <>
                    <Route
                      path="/produccion"
                      element={<Protected roles={["admin", "super_admin", "produccion", "diseno", "administradora"]}><ProduccionPage /></Protected>}
                    />
                    <Route
                      path="/produccion/ficha/:id"
                      element={<Protected roles={["admin", "super_admin", "produccion", "diseno", "administradora"]}><ProduccionFichaPage /></Protected>}
                    />
                  </>
                )}

                {/* Postventa y GarantÃ­as (migraciÃ³n 055). Si VITE_FF_POSTVENTA=false
                    la ruta no se registra y cae en el 404. */}
                {FEATURES.postventaEnabled && (
                  <Route
                    path="/postventa"
                    element={<Protected roles={["admin", "super_admin", "comercial", "administradora"]}><PostventaPage /></Protected>}
                  />
                )}

                {/* Centro de Decisiones (migración 057): cuestionarios que la
                    gerencia responde en el CRM; el equipo técnico lee de la DB. */}
                <Route
                  path="/decisiones"
                  element={<Protected roles={["admin", "super_admin", "gerente"]}><DecisionesPage /></Protected>}
                />
                <Route
                  path="/decisiones/:slug"
                  element={<Protected roles={["admin", "super_admin", "gerente"]}><DecisionDetailPage /></Protected>}
                />

                {/* Agentes hub */}
                <Route path="/agentes" element={<Protected><AgentesPage /></Protected>} />
                <Route path="/agentes/seguimiento-cotizaciones" element={<Protected><SeguimientoCotizacionesPage /></Protected>} />
                <Route path="/agentes/:agentId" element={<Protected><AgentDetailPage /></Protected>} />

                {/* Motor Comercial */}
                <Route path="/motor-comercial" element={<Protected><MotorComercialPage /></Protected>} />

                {/* Projects */}
                <Route path="/projects"     element={<Protected><ProjectsPage /></Protected>} />
                <Route path="/projects/new" element={<Protected><ProjectCreatePage /></Protected>} />
                <Route path="/projects/:id" element={<Protected><ProjectDetailPage /></Protected>} />

                {/* Clients */}
                <Route path="/clients"     element={<Protected><ClientsPage /></Protected>} />

                {/* Leads */}
                <Route path="/leads"     element={<Protected><LeadsPage /></Protected>} />
                <Route path="/leads/new" element={<Protected><LeadCreatePage /></Protected>} />
                <Route path="/solicitudes/leads"     element={<Navigate to="/leads" replace />} />
                <Route path="/solicitudes/leads/new" element={<Navigate to="/leads/new" replace />} />

                {/* Quotations */}
                <Route path="/quotations"      element={<Protected><QuotationsPage /></Protected>} />
                <Route path="/quotations/new"  element={<Protected><QuotationCreatePage /></Protected>} />
                <Route path="/quotations/:id"  element={<Protected><QuotationDetailPage /></Protected>} />
                <Route path="/quotes"          element={<Navigate to="/quotations" replace />} />

                {/* Agenda & Tasks */}
                <Route path="/agenda"      element={<Protected><AgendaPage /></Protected>} />
                <Route path="/reuniones"   element={<Protected><ReunionesPage /></Protected>} />
                <Route path="/agenda/hoy"  element={<Protected><MyDayPage /></Protected>} />
                <Route path="/tasks"       element={<Protected><TareasPage /></Protected>} />

                {/* Notifications */}
                <Route path="/notifications"          element={<Protected><NotificationsPage /></Protected>} />
                <Route path="/notificaciones"         element={<Navigate to="/notifications" replace />} />
                <Route path="/agenda/recordatorios"   element={<Navigate to="/notifications" replace />} />

                {/* Inventory */}
                <Route path="/inventory"     element={<Protected><InventoryPage /></Protected>} />
                <Route path="/inventory/new" element={<Protected><InventoryCreatePage /></Protected>} />

                {/* Finanzas */}
                <Route path="/finanzas/pagos"   element={<Protected><PagosPage /></Protected>} />
                <Route path="/finanzas/gastos"  element={<Protected><GastosPage /></Protected>} />
                <Route path="/finanzas/cierres" element={<Protected><CierresContablesPage /></Protected>} />

                {/* User */}
                <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

                {/* Settings */}
                <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
                <Route
                  path="/settings/users"
                  element={<Protected roles={["admin", "super_admin"]}><UsersSettingsPage /></Protected>}
                />
                <Route
                  path="/settings/users/new"
                  element={<Protected roles={["admin", "super_admin"]}><UserCreatePage /></Protected>}
                />
                <Route
                  path="/settings/audit"
                  element={<Protected roles={["admin", "super_admin"]}><AuditSettingsPage /></Protected>}
                />
                <Route path="/settings/whatsapp"       element={<Protected><WhatsAppSettingsPage /></Protected>} />
                <Route path="/settings/materials"      element={<Protected><MaterialsSettingsPage /></Protected>} />
                <Route path="/settings/materials/new"  element={<Protected><MaterialCreatePage /></Protected>} />
                <Route path="/settings/pricing"        element={<Protected><PricingSettingsPage /></Protected>} />
                <Route path="/settings/pricing/new"    element={<Protected><PricingCreatePage /></Protected>} />
                <Route path="/settings/holidays"       element={<Protected><HolidaysSettingsPage /></Protected>} />
                <Route path="/settings/holidays/new"   element={<Protected><HolidayCreatePage /></Protected>} />
                <Route
                  path="/settings/bancarios"
                  element={<Protected roles={["admin", "super_admin"]}><BankSettingsPage /></Protected>}
                />
                <Route
                  path="/settings/pagos"
                  element={<Protected roles={["admin", "super_admin"]}><PaymentSettingsPage /></Protected>}
                />
                <Route path="/settings/parameters"     element={<Protected><ParametersSettingsPage /></Protected>} />
                <Route path="/settings/notifications"  element={<Protected><NotificationsSettingsPage /></Protected>} />
                <Route
                  path="/settings/maintenance"
                  element={<Protected roles={["admin", "super_admin"]}><MaintenanceSettingsPage /></Protected>}
                />
                <Route
                  path="/admin/dictionary"
                  element={<Protected roles={["admin", "super_admin"]}><DictionaryPage /></Protected>}
                />

                {/* Soporte — sistema de tickets */}
                <Route path="/soporte"       element={<Protected><SoportePage /></Protected>} />
                <Route path="/soporte/nuevo" element={<Protected><NuevoTicketPage /></Protected>} />
                <Route path="/soporte/:id"   element={<Protected><TicketDetallePage /></Protected>} />

                {/* Horas laborales */}
                <Route path="/horas" element={<Protected><HorasPage /></Protected>} />

                {/* DocumentaciÃ³n */}
                <Route path="/docs"                          element={<Protected><DocsHomePage /></Protected>} />
                <Route path="/docs/automatizaciones"         element={<Protected><DocsAutomatizacionesPage /></Protected>} />
                <Route path="/docs/automatizaciones/:slug"   element={<Protected><DocsAutomatizacionDetailPage /></Protected>} />
                <Route path="/docs/habilidades"              element={<Protected><DocsHabilidadesPage /></Protected>} />

                {/* 404 catch-all */}
                <Route path="*" element={<Protected><NotFoundPage /></Protected>} />
              </Routes>
            </Suspense>
          </Router>
          <ConnectionBanner />
          <PremiumToaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

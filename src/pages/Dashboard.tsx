import * as React from "react";
import {
  Download,
  LayoutDashboard,
  TrendingUp,
  CalendarClock,
  CalendarPlus,
  ArrowUpRight,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuthStore } from "@/store/authStore";
import { useNavigate } from "react-router-dom";
import { formatDate } from "@/lib/format-utils";
import { notify } from "@/components/ui/PremiumToast";
import { PremiumLoader, PremiumLoadingOverlay } from "@/components/shared/PremiumLoader";
import { WelcomeBanner } from "@/components/dashboard/WelcomeBanner";
import { DashboardQuickAccess } from "@/components/dashboard/DashboardQuickAccess";
import { WeeklyTasksSummary } from "@/components/dashboard/WeeklyTasksSummary";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useExpenses } from "@/hooks/finanzas/useExpenses";
import { useClosures } from "@/hooks/finanzas/useClosures";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { getNextMeetingDate, fmtCO, cap, VISITOR_NAME, MEETING_HOUR_LABEL } from "@/lib/reuniones";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_PROGRESS: Record<string, number> = {
  contacto: 5,
  medicion_tomada: 12,
  cotizacion_enviada: 22,
  cotizacion_aprobada: 32,
  en_diseno: 44,
  modelado_listo: 55,
  renders_listos: 66,
  aprobacion_cliente: 74,
  en_produccion: 83,
  instalacion_programada: 88,
  instalando: 93,
  entregado: 100,
  garantia: 100,
};

const STATUS_LABELS: Record<string, string> = {
  contacto: "Contacto",
  medicion_tomada: "Medición",
  cotizacion_enviada: "Cotiz. enviada",
  cotizacion_aprobada: "Cotiz. aprobada",
  en_diseno: "En diseño",
  modelado_listo: "Modelado listo",
  renders_listos: "Renders listos",
  aprobacion_cliente: "Aprob. cliente",
  en_produccion: "Fabricación",
  instalacion_programada: "Inst. programada",
  instalando: "Instalación",
  entregado: "Entregado",
  garantia: "Garantía",
};

const WORK_TYPE_LABELS: Record<string, string> = {
  cocina: "Cocina",
  closet: "Closet",
  puertas: "Puertas",
  centro_tv: "Centro TV",
};

const MONTHS_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const formatCOP = (amount: number): string => {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString("es-CO")}`;
};

// ─── Animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);

  // ── Real data hooks ─────────────────────────────────────────────────────────
  const { data: projectsData = [] } = useProjects();

  // Background prefetch
  useExpenses({ project_id: "all", category: "all", approval_status: "all", date_from: "", date_to: "" });
  useClosures({ status: "all", date_from: "", date_to: "" });
  useClients();

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // ── Chart data: projects created vs delivered per month (last 6 months) ─────
  const productionData = React.useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(currentYear, currentMonth - 5 + i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();

      const created = projectsData.filter((p) => {
        const pd = new Date(p.created_at);
        return pd.getMonth() === m && pd.getFullYear() === y;
      }).length;

      const delivered = projectsData.filter((p) => {
        if (!p.delivered_at) return false;
        const pd = new Date(p.delivered_at);
        return pd.getMonth() === m && pd.getFullYear() === y;
      }).length;

      return { name: MONTHS_NAMES[m], production: created, delivery: delivered };
    });
  }, [projectsData, currentMonth, currentYear]);

  // ── Priority projects: most advanced active projects ────────────────────────
  const priorityProjects = React.useMemo(() => {
    return projectsData
      .filter((p) => !["entregado", "garantia"].includes(p.status) && !p.is_archived)
      .sort((a, b) => (STATUS_PROGRESS[b.status] || 0) - (STATUS_PROGRESS[a.status] || 0))
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name: p.name,
        progress: STATUS_PROGRESS[p.status] || 5,
      }));
  }, [projectsData]);

  // ── Recent commissions: latest projects ────────────────────────────────────
  const commissions = React.useMemo(() => {
    return projectsData.slice(0, 6).map((p: any) => {
      const clientName: string = p.client?.name || "Sin cliente";
      return {
        id: clientName.substring(0, 2).toUpperCase(),
        client: clientName,
        style: WORK_TYPE_LABELS[p.work_type] || p.work_type,
        statusLabel: STATUS_LABELS[p.status] || p.status,
        statusRaw: p.status,
        value: p.total_amount ? formatCOP(p.total_amount) : "Sin cotizar",
        designer: p.designer?.full_name || "Sin asignar",
        date: new Date(p.created_at).toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    });
  }, [projectsData]);

  // ── Próxima reunión (visita de Álvaro Ríos) ─────────────────────────────────
  const nextMeeting = React.useMemo(() => getNextMeetingDate(), []);
  const nextMeetingLabel = nextMeeting ? cap(fmtCO.format(nextMeeting)) : null;

  // ── Misc ────────────────────────────────────────────────────────────────────
  const rawName = (profile?.full_name || user?.email || "").split("@")[0].split(" ")[0];
  const friendlyName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : "";

  React.useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadPDF = (e: React.MouseEvent, client: string) => {
    e.stopPropagation();
    setIsGeneratingPDF(true);

    setTimeout(async () => {
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();

        const primaryColor = { r: 68, g: 221, b: 193 };
        const darkColor = { r: 30, g: 58, b: 53 };
        const grayColor = { r: 100, g: 116, b: 139 };

        doc.setFillColor(darkColor.r, darkColor.g, darkColor.b);
        doc.rect(0, 0, 210, 45, "F");

        doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.rect(0, 43, 210, 2, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(26);
        doc.setFont("helvetica", "bold");
        doc.text("INNOVAR", 20, 25);

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.text("INTERIOR | INGENIERÍA DE MOBLIAIRO ÉLITE", 20, 33);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("Instagram: @INNOVAR_DESIGN", 145, 20);
        doc.text("Facebook: Innovar Interior", 145, 25);
        doc.text("Web: www.innovar.com", 145, 30);

        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("CERTIFICADO DE COMISIÓN", 20, 65);

        doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.setLineWidth(0.8);
        doc.line(20, 70, 70, 70);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
        doc.text(`Fecha de Emisión: ${formatDate(new Date())}`, 145, 65);

        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, 85, 170, 40, 2, 2, "F");

        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DEL PROYECTO", 25, 95);

        doc.setFontSize(11);
        doc.text(`CLIENTE: ${client.toUpperCase()}`, 25, 105);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`ID DE REPORTE: INV-COMM-${Math.floor(1000 + Math.random() * 9000)}`, 25, 115);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(darkColor.r, darkColor.g, darkColor.b);
        doc.text("MEMORÁNDUM DE GESTIÓN:", 20, 145);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(50, 50, 50);
        const bodyContent =
          "Por medio del presente documento, el sistema de ingeniería INNOVAR certifica los parámetros comerciales y técnicos vinculados a la comisión del proyecto arriba mencionado. Esta propuesta ha sido validada bajo estricto control de calidad, asegurando que cada detalle constructivo y financiero cumple con los estándares de excelencia de nuestra marca.";
        const splitBody = doc.splitTextToSize(bodyContent, 170);
        doc.text(splitBody, 20, 155);

        const items = [
          "- Validación de Materiales: 100% Completado",
          "- Ingeniería de Detalle: Verificada",
          "- Cronograma de Producción: Asignado",
          "- Estado Financiero: En Proceso de Liquidación",
        ];

        let currentY = 180;
        items.forEach((item) => {
          doc.text(item, 25, currentY);
          currentY += 8;
        });

        const footerY = 265;
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(20, footerY, 190, footerY);

        doc.setFontSize(8);
        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
        doc.setFont("helvetica", "bold");
        doc.text("DATOS DE CONTACTO", 20, footerY + 10);

        doc.setFont("helvetica", "normal");
        doc.text("Email: proyectos@innovar.com", 20, footerY + 16);
        doc.text("Teléfono: +57 (311) 234-5678", 20, footerY + 22);
        doc.text("Showroom: Cali, Valle del Cauca", 20, footerY + 28);

        doc.setFillColor(darkColor.r, darkColor.g, darkColor.b);
        doc.rect(160, footerY + 8, 30, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("INNOVAR", 163, footerY + 18);
        doc.setFontSize(5);
        doc.text("ENGINEERING SYSTEM", 163, footerY + 23);

        doc.setTextColor(grayColor.r, grayColor.g, grayColor.b);
        doc.setFontSize(7);
        doc.text("Documento generado electrónicamente por el Ecosistema INNOVAR.", 110, footerY + 35);

        doc.save(`Informe_Comision_${client.replace(/\s+/g, "_")}.pdf`);

        notify.success("Informe generado", `Informe de comisión para ${client} descargado correctamente.`);
      } catch (error) {
        console.error("PDF Error:", error);
        notify.error("Error", "Error al generar el informe PDF.");
      } finally {
        setIsGeneratingPDF(false);
      }
    }, 1500);
  };

  if (isInitialLoading) {
    return (
      <div className="h-[70vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Sincronizando Ecosistema INNOVAR" />
      </div>
    );
  }

  return (
    <>
      {isGeneratingPDF && <PremiumLoadingOverlay text="Generando Informe de Alta Precisión..." />}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto w-full space-y-12"
      >
        <WelcomeBanner userName={friendlyName} />

        {/* ── Weekly Tasks Summary — above the fold ── */}
        <motion.div variants={itemVariants}>
          <WeeklyTasksSummary />
        </motion.div>

        {/* Quick Access Grid */}
        <motion.div variants={itemVariants}>
          <DashboardQuickAccess />
        </motion.div>

        {/* ── Middle Row ── */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Area Chart */}
          <div className="lg:col-span-2 bg-card p-8 rounded-sm relative overflow-hidden border border-border/10">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="text-xl font-bold font-heading text-foreground uppercase tracking-tight">
                  Proyectos creados vs. entregados
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Últimos 6 meses — datos reales
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full"></span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    Creados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-secondary rounded-full"></span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    Entregados
                  </span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={productionData}>
                  <defs>
                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--color-border)"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#85948f", fontSize: 10, fontWeight: "bold" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#85948f", fontSize: 10 }}
                    allowDecimals={false}
                    width={24}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      fontSize: "10px",
                    }}
                    itemStyle={{ color: "var(--color-primary)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="production"
                    name="Creados"
                    stroke="var(--color-primary)"
                    fillOpacity={1}
                    fill="url(#colorProd)"
                    strokeWidth={2}
                    animationDuration={400}
                  />
                  <Area
                    type="monotone"
                    dataKey="delivery"
                    name="Entregados"
                    stroke="var(--color-secondary)"
                    fill="transparent"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    animationDuration={400}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Priority projects */}
          <div className="bg-muted/30 p-8 rounded-sm border border-border/10">
            <h2 className="text-xl font-bold font-heading text-foreground mb-6 uppercase tracking-tight">
              Prioridad Alta
            </h2>
            {priorityProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
                <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                <p>Sin proyectos activos</p>
              </div>
            ) : (
              <div className="space-y-6">
                {priorityProjects.map((project) => (
                  <div key={project.id} className="group cursor-pointer">
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate max-w-[160px]" title={project.name}>
                        {project.name}
                      </span>
                      <span className="text-[10px] text-primary font-bold shrink-0 ml-2">
                        {project.progress}%
                      </span>
                    </div>
                    <div className="h-1 bg-muted w-full">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${project.progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PrimaryButton
              onClick={() => navigate("/projects")}
              label="Ver Pipeline Completo"
              className="mt-10 w-full rounded-md"
            />
          </div>
        </motion.div>

        {/* ── Recent projects table ── */}
        <motion.div variants={itemVariants} className="bg-card rounded-sm p-8 border border-border/10">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black font-heading text-foreground tracking-tight uppercase">
              Proyectos Recientes
            </h2>
            <PrimaryButton
              onClick={() => handleDownloadPDF({ stopPropagation: () => {} } as any, "General")}
              loading={isGeneratingPDF}
              label="Exportar Reporte Global"
              icon={Download}
              className="rounded-md"
            />
          </div>

          {commissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <LayoutDashboard className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No hay proyectos registrados aún</p>
              <p className="text-xs mt-1">Los proyectos aparecerán aquí cuando se creen</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/10 hover:bg-transparent">
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Cliente / Diseñador
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Tipo de Proyecto
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                      Estado
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                      Valor Contrato
                    </TableHead>
                    <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                      Informe PDF
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((item, idx) => (
                    <TableRow
                      key={`${item.client}-${idx}`}
                      onClick={() => navigate("/projects")}
                      className="border-border/10 hover:bg-accent/30 transition-all duration-200 cursor-pointer group border-l-4 border-l-transparent hover:border-l-primary"
                    >
                      <TableCell className="py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center font-bold text-xs text-primary border border-border/30 group-hover:border-primary transition-all">
                            {item.id}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {item.client}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                              Diseño: {item.designer}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-5">
                        <div className="flex flex-col">
                          <span className="text-sm text-foreground font-medium">{item.style}</span>
                          <span className="text-[10px] text-muted-foreground">{item.date}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-5 text-center">
                        <StatusBadge
                          variant={
                            ["en_produccion"].includes(item.statusRaw)
                              ? "warning"
                              : ["instalando", "instalacion_programada"].includes(item.statusRaw)
                              ? "purple"
                              : item.statusRaw === "entregado"
                              ? "success"
                              : "info"
                          }
                          dot
                          animate="scale"
                        >
                          {item.statusLabel}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="py-5 text-right font-mono text-sm font-bold text-foreground">
                        {item.value}
                      </TableCell>
                      <TableCell className="py-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDownloadPDF(e, item.client)}
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 gap-2 font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden md:inline">Descargar</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </motion.div>

        {/* ── Próxima reunión ── */}
        {nextMeeting && (
          <motion.button
            variants={itemVariants}
            onClick={() => navigate("/reuniones")}
            className="group relative w-full text-left overflow-hidden bg-card border border-primary/20 rounded-sm shadow-lg shadow-primary/5 hover:border-primary/40 transition-colors"
          >
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-sm border border-primary/20 shrink-0">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                    Próxima reunión
                  </span>
                  <p className="text-lg font-black tracking-tight text-foreground leading-tight">
                    {nextMeetingLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {MEETING_HOUR_LABEL} · Visita de {VISITOR_NAME} a domicilio
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary group-hover:gap-3 transition-all">
                <CalendarPlus className="w-4 h-4" /> Ver agenda <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </motion.button>
        )}
      </motion.div>
    </>
  );
}


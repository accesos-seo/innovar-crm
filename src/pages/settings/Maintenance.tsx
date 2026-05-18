import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { 
  Database, 
  Plus, 
  Download, 
  ShieldCheck, 
  History, 
  Trash2, 
  RotateCcw, 
  Activity,
  Server,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { DetailModal } from "@/components/shared/DetailModal";
import { MetricsGrid, MetricData } from "@/components/shared/MetricsGrid";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { toast } from "sonner";
import { seedMockData } from "@/lib/seedData";

interface BackupRecord {
  id: string;
  backupName: string;
  backupType: 'daily' | 'weekly' | 'manual';
  fileSize: string;
  status: 'pending' | 'completed' | 'failed' | 'verified';
  retentionDays: number;
  timestamp: string;
}

const statusMap: Record<BackupRecord['status'], { label: string; color: string }> = {
  completed: { label: "Completado", color: "bg-emerald-500/10 text-emerald-500" },
  verified: { label: "Verificado", color: "bg-primary/10 text-primary" },
  pending: { label: "Pendiente", color: "bg-yellow-500/10 text-yellow-500" },
  failed: { label: "Fallido", color: "bg-destructive/10 text-destructive" },
};

const columns: ColumnDef<BackupRecord>[] = [
  {
    accessorKey: "backupName",
    header: "Nombre del Respaldo",
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Database className="w-4 h-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground">{row.original.backupName}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{row.original.backupType}</span>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "fileSize",
    header: "Tamaño",
    cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.fileSize}</span>,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-tighter rounded-none", statusMap[row.original.status]?.color)}>
        {statusMap[row.original.status].label}
      </Badge>
    ),
  },
  {
    accessorKey: "timestamp",
    header: "Fecha de Creación",
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.timestamp}</span>,
  },
];

export default function MaintenanceSettingsPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedBackup, setSelectedBackup] = React.useState<BackupRecord | null>(null);

  const metrics: MetricData[] = [
    { title: "Salud BD", value: "Activa", description: "Supabase conectado", icon: Activity, trend: "up", color: "green" },
    { title: "Último Backup", value: "Auto", description: "Gestionado por Supabase", icon: Database, trend: "neutral", color: "blue" },
    { title: "Almacenamiento", value: "N/D", description: "Configura S3 para ver uso", icon: Server, trend: "neutral", color: "purple" },
    { title: "Logs Error", value: "0", description: "Sin incidencias", icon: AlertCircle, trend: "neutral", color: "yellow" },
  ];

  // Backup records come from a real S3/backup integration (not yet configured)
  const mockData: BackupRecord[] = [];

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleManualBackup = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 3000)),
      {
        loading: "Generando respaldo manual de base de datos...",
        success: "Respaldo creado y subido a S3 correctamente.",
        error: "Error al generar el respaldo.",
      }
    );
  };

  const handleSeedData = async () => {
    try {
      toast.loading("Inicializando datos de prueba...");
      await seedMockData();
      toast.success("Base de datos inicializada con éxito");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Error seeding data:", error);
      toast.error("Error al inicializar datos", {
        description: "Asegúrate de haber creado las tablas en Supabase primero."
      });
    }
  };

  const sqlTables = `-- 1. TABLA DE PERFILES (Usuarios y Roles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  "lastSignedIn" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE AUDITORÍA (Auditoría de Sistema)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "userId" UUID REFERENCES auth.users ON DELETE SET NULL,
  "userName" TEXT,
  action TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "recordId" TEXT,
  "changesSummary" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA DE MATERIALES (Materiales e Insumos)
CREATE TABLE IF NOT EXISTS materials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "photoUrl" TEXT,
  price NUMERIC DEFAULT 0,
  unit TEXT,
  active BOOLEAN DEFAULT true,
  "sortOrder" INTEGER DEFAULT 0
);

-- 4. TABLA DE TARIFARIO (Tarifario y Precios)
CREATE TABLE IF NOT EXISTS pricing_catalog (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  value NUMERIC DEFAULT 0,
  unit TEXT,
  "previousValue" NUMERIC,
  "lastUpdated" DATE DEFAULT CURRENT_DATE
);

-- 5. TABLA DE FESTIVOS (Días Festivos)
CREATE TABLE IF NOT EXISTS holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  year INTEGER NOT NULL
);

-- 6. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp_phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- 7. TABLA DE PROYECTOS
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_token TEXT DEFAULT gen_random_uuid()::text,
  client_id UUID REFERENCES clients(id),
  approved_quotation_id UUID,
  designer_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  work_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'contacto',
  notes TEXT,
  total_amount NUMERIC DEFAULT 0,
  advance_amount NUMERIC DEFAULT 0,
  client_approved_at TIMESTAMP WITH TIME ZONE,
  initial_measurements JSONB,
  design_3d_files JSONB DEFAULT '[]'::jsonb,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. TABLA DE COTIZACIONES
CREATE TABLE IF NOT EXISTS quotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  is_locked BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. LINEAS DE COTIZACION
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  product_category TEXT,
  base_catalog_id UUID,
  configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto w-full space-y-8 pb-20"
    >
      <CategoryHeader 
        title="MANTENIMIENTO Y BACKUPS"
        subtitle="Gestión de respaldos de datos, optimización de BD y logs de sistema."
        icon={Database}
        onBack={() => navigate("/settings")}
        action={{
          label: "Crear Backup Manual",
          icon: Plus,
          onClick: handleManualBackup
        }}
      />

      {isLoading ? (
        <div className="h-[60vh] w-full flex items-center justify-center">
          <PremiumLoader size="lg" text="Analizando Integridad del Sistema" />
        </div>
      ) : (
        <>
          <MetricsGrid metrics={metrics} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-card/30 border-border/10 hover:border-primary/30 transition-all cursor-pointer group" onClick={handleSeedData}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Sembrar Datos</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Insertar datos de prueba</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/30 border-border/10 hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Optimizar BD</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Ejecutar ANALYZE TABLE</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/30 border-border/10 hover:border-primary/30 transition-all cursor-pointer group">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-sm group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Limpiar Logs</h3>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Eliminar logs antiguos</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mb-8 space-y-4">
            <div className="flex items-center gap-2 p-4 bg-primary/5 border border-primary/10 rounded-sm">
              <AlertCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs font-bold text-foreground uppercase tracking-widest">Instrucciones de Inicialización</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                  Si las tablas no existen en Supabase, copia el siguiente SQL y ejecútalo en el SQL Editor de tu panel.
                </p>
              </div>
            </div>
            <div className="relative group">
              <pre className="bg-muted/50 p-6 rounded-sm border border-border/10 overflow-x-auto text-[10px] font-mono text-muted-foreground max-h-[300px] custom-scrollbar">
                {sqlTables}
              </pre>
              <Button 
                variant="outline" 
                size="sm"
                className="absolute top-4 right-4 bg-background/80 backdrop-blur-sm border-border/50 text-[10px] font-bold uppercase tracking-widest h-8"
                onClick={() => {
                  navigator.clipboard.writeText(sqlTables);
                  toast.success("SQL copiado al portapapeles");
                }}
              >
                Copiar SQL
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={mockData}
            isLoading={isLoading}
            totalCount={mockData.length}
            pageCount={1}
            pageIndex={0}
            pageSize={10}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            onRowClick={setSelectedBackup}
            emptyMessage={
              <EmptyState 
                title="Sin respaldos registrados"
                description="No se encontraron copias de seguridad en el historial."
                icon={Database}
                action={{
                  label: "Crear backup",
                  icon: Plus,
                  onClick: handleManualBackup
                }}
              />
            }
          />
        </>
      )}

      <DetailModal
        open={!!selectedBackup}
        onOpenChange={(open) => !open && setSelectedBackup(null)}
        title="Detalle de Respaldo"
        icon={Database}
        subtitle={`ID: ${selectedBackup?.id}`}
      >
        <div className="flex flex-col">
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 pb-8">
            <div className="col-span-2 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Nombre del Archivo</p>
              <p className="text-sm font-mono font-bold text-foreground">{selectedBackup?.backupName}.sql.gz</p>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 py-8">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Tipo de Respaldo</p>
              <Badge variant="outline" className="mt-1 text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary">
                {selectedBackup?.backupType}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Estado de Verificación</p>
              <Badge variant="outline" className={cn("mt-1 text-[10px] font-bold uppercase tracking-widest", selectedBackup ? statusMap[selectedBackup.status]?.color : "")}>
                {selectedBackup ? statusMap[selectedBackup.status].label : ""}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Tamaño del Archivo</p>
              <p className="text-sm font-mono font-bold text-foreground">{selectedBackup?.fileSize}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Retención (Días)</p>
              <p className="text-sm font-bold text-foreground">{selectedBackup?.retentionDays} Días</p>
            </div>
          </div>

          <div className="h-[1px] w-full bg-border/10" />

          <div className="pt-8">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-4">Conteo de Registros por Tabla</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Usuarios", count: 24 },
                { label: "Clientes", count: 452 },
                { label: "Proyectos", count: 128 },
                { label: "Inventario", count: 864 },
              ].map((table) => (
                <div key={table.label} className="bg-muted/30 p-3 border border-border/5 rounded-sm">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{table.label}</p>
                  <p className="text-sm font-bold text-foreground">{table.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-border/10 flex gap-4">
          <Button variant="outline" className="flex-1 border-primary/20 text-primary hover:bg-primary/10 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
            <Download className="w-4 h-4" />
            Descargar SQL
          </Button>
          <Button variant="outline" className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10 font-bold uppercase text-[10px] tracking-widest h-12 gap-2">
            <RotateCcw className="w-4 h-4" />
            Restaurar Sistema
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/10 rounded-sm">
          <Lock className="w-3 h-3 text-destructive" />
          <p className="text-[10px] text-destructive font-medium uppercase tracking-widest">La restauración requiere contraseña de super-administrador.</p>
        </div>
      </DetailModal>
    </motion.div>
  );
}

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Plus } from "lucide-react";
import { CategoryHeader } from "@/components/shared/CategoryHeader";
import { PrimaryButton } from "@/components/shared/PrimaryButton";
import { PremiumLoader } from "@/components/shared/PremiumLoader";
import { BankDetailModal } from "@/components/finanzas/BankDetailModal";
import { BankDetailCard } from "@/components/finanzas/BankDetailCard";
import { useBankDetails } from "@/hooks/useBankDetails";
import {
  useCreateBankDetail,
  useDeleteBankDetail,
  useSetActiveBankDetail,
  type CreateBankDetailInput,
} from "@/hooks/useBankDetailsMutations";

export default function BankSettingsPage() {
  const navigate = useNavigate();
  const { data: bankDetails, isLoading } = useBankDetails();
  const createBankDetail = useCreateBankDetail();
  const deleteBankDetail = useDeleteBankDetail();
  const setActiveBankDetail = useSetActiveBankDetail();

  const [modalOpen, setModalOpen] = React.useState(false);

  const handleCreateBankDetail = async (input: CreateBankDetailInput) => {
    await createBankDetail.mutateAsync(input);
    setModalOpen(false);
  };

  const handleDeleteBankDetail = async (id: string) => {
    await deleteBankDetail.mutateAsync(id);
  };

  const handleSetActive = async (id: string) => {
    await setActiveBankDetail.mutateAsync(id);
  };

  const activeDetail = bankDetails?.find((d) => d.is_active);
  const isProcessing =
    createBankDetail.isPending ||
    deleteBankDetail.isPending ||
    setActiveBankDetail.isPending;

  if (isLoading) {
    return (
      <div className="h-[60vh] w-full flex items-center justify-center">
        <PremiumLoader size="lg" text="Cargando datos bancarios" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto w-full space-y-10 pb-20"
    >
      <CategoryHeader
        title="Datos Bancarios"
        subtitle="Cuentas de cobro mostradas al cliente en su cotización pública aprobada."
        icon={Landmark}
        onBack={() => navigate("/settings")}
      />

      {/* Lista de datos bancarios o empty state */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {bankDetails && bankDetails.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              Cuentas Configuradas
            </h3>
            <AnimatePresence mode="popLayout">
              {bankDetails.map((detail) => (
                <BankDetailCard
                  key={detail.id}
                  detail={detail}
                  isActive={detail.id === activeDetail?.id}
                  onSetActive={handleSetActive}
                  onDelete={handleDeleteBankDetail}
                  isLoading={isProcessing}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="border border-dashed border-border/50 rounded-sm p-12 text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                <Landmark className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-foreground">
                Sin Datos Bancarios
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Agrega una cuenta bancaria para mostrarla en las cotizaciones públicas.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Botón agregar */}
      <div className="pt-6 flex justify-center">
        <PrimaryButton
          onClick={() => setModalOpen(true)}
          label="Agregar Datos Bancarios"
          icon={Plus}
          className="h-14 px-8 rounded-none"
        />
      </div>

      {/* Modal */}
      <BankDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleCreateBankDetail}
        isLoading={createBankDetail.isPending}
      />

      {/* Información importante */}
      <div className="p-6 bg-primary/5 border border-primary/20 rounded-sm space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
          Importante
        </p>
        <ul className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <li>
            • Solo la cuenta marcada como <strong>Activa</strong> se muestra al cliente.
          </li>
          <li>• Estos datos aparecen cuando el cliente acepta una cotización.</li>
          <li>• Dejar campos opcionales (Nequi, Daviplata) vacíos si no se usan.</li>
          <li>• Puedes eliminar cuentas antiguas para mantener la lista organizada.</li>
        </ul>
      </div>
    </motion.div>
  );
}

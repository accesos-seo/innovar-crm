import * as React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useQuotationBuilder } from '@/hooks/quotations/useQuotationBuilder';
import { QuotationStepper } from './steps/QuotationStepper';
import { QuotationClientStep } from './steps/QuotationClientStep';
import { QuotationDesignStep } from './steps/QuotationDesignStep';
import { QuotationReviewStep } from './steps/QuotationReviewStep';

export const QuotationBuilder: React.FC = () => {
  const state = useQuotationBuilder();

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-10 pb-32 px-4 lg:px-8">
      <QuotationStepper currentStep={state.currentStep} />

      <AnimatePresence mode="wait">
        {state.isInitializingContext && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="w-12 h-12 text-primary/50 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Iniciando cotización...</p>
          </div>
        )}

        {state.currentStep === 1 && !state.isInitializingContext && (
          <QuotationClientStep
            selectedClient={state.selectedClient}
            setSelectedClient={state.setSelectedClient}
            clientSearch={state.clientSearch}
            setClientSearch={state.setClientSearch}
            clients={state.clients}
            isSearching={state.isSearching}
            isDialogOpen={state.isDialogOpen}
            setIsDialogOpen={state.setIsDialogOpen}
            isCreatingClient={state.isCreatingClient}
            newClientData={state.newClientData}
            setNewClientData={state.setNewClientData}
            handleCreateClient={state.handleCreateClient}
            onNext={() => state.setCurrentStep(2)}
          />
        )}

        {state.currentStep === 2 && !state.isInitializingContext && (
          <QuotationDesignStep
            selectedClient={state.selectedClient}
            leadContext={state.leadContext}
            isContextExpanded={state.isContextExpanded}
            setIsContextExpanded={state.setIsContextExpanded}
            activeTab={state.activeTab}
            setActiveTab={state.setActiveTab}
            items={state.items}
            setItems={state.setItems}
            transportDisplay={state.transportDisplay}
            setTransportDisplay={state.setTransportDisplay}
            discountDisplay={state.discountDisplay}
            setDiscountDisplay={state.setDiscountDisplay}
            transportCost={state.transportCost}
            totals={state.totals}
            handleItemDataChange={state.handleItemDataChange}
            handleTransportCheckbox={state.handleTransportCheckbox}
            onBack={() => state.setCurrentStep(1)}
            onNext={() => state.setCurrentStep(3)}
          />
        )}

        {state.currentStep === 3 && !state.isInitializingContext && (
          <QuotationReviewStep
            items={state.items}
            transportCost={state.transportCost}
            discountPercent={state.discountPercent}
            setDiscountPercent={state.setDiscountPercent}
            totals={state.totals}
            isSaving={state.isSaving}
            handleSaveQuotation={state.handleSaveQuotation}
            handlePrintPDF={state.handlePrintPDF}
            onBack={() => state.setCurrentStep(2)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

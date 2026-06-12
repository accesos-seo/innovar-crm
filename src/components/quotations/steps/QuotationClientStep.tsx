import * as React from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Search, User, ChevronRight, Loader2, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { WhatsAppField } from '@/components/shared/WhatsAppField';
import { DEFAULT_COUNTRIES } from '@/hooks/usePhoneInput';
import { useNavigate } from 'react-router-dom';
import type { QuotationClient } from '@/hooks/quotations/useQuotationBuilder';

interface QuotationClientStepProps {
  selectedClient: QuotationClient | null;
  setSelectedClient: (c: QuotationClient | null) => void;
  clientSearch: string;
  setClientSearch: (s: string) => void;
  clients: QuotationClient[];
  isSearching: boolean;
  isDialogOpen: boolean;
  setIsDialogOpen: (v: boolean) => void;
  isCreatingClient: boolean;
  newClientData: { name: string; email: string; whatsapp_phone: string };
  setNewClientData: (d: { name: string; email: string; whatsapp_phone: string }) => void;
  handleCreateClient: () => void;
  onNext: () => void;
}

export function QuotationClientStep({
  selectedClient, setSelectedClient,
  clientSearch, setClientSearch,
  clients, isSearching,
  isDialogOpen, setIsDialogOpen,
  isCreatingClient, newClientData, setNewClientData,
  handleCreateClient, onNext,
}: QuotationClientStepProps) {
  const navigate = useNavigate();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2 mb-12">
        <h2 className="text-4xl font-black text-foreground tracking-tighter uppercase">Selección de Cliente</h2>
        <p className="text-muted-foreground text-sm">Comienza vinculando esta cotización a un cliente registrado.</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {selectedClient ? (
          <Card className="border-2 border-primary bg-primary/5 p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <User className="w-24 h-24 text-primary" />
            </div>
            <div className="flex items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-foreground">{selectedClient.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedClient.email || 'Sin correo registrado'}</p>
                  <p className="text-xs font-mono text-primary flex items-center gap-1">
                    <Check className="w-3 h-3" /> ID: {selectedClient.id}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedClient(null)}
                className="text-[10px] font-bold uppercase tracking-widest border-primary/30 text-primary hover:bg-primary/10 rounded-none h-11 px-6"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Cambiar
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="relative group flex-1">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 pointer-events-none" />
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                <Input
                  placeholder="Busca por nombre, apellido o ID..."
                  className="pl-16 h-20 text-xl font-medium border-border/40 focus-visible:ring-primary shadow-2xl rounded-none bg-card/50 relative z-10"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                />
              </div>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger
                  render={(props) => (
                    <Button
                      {...props}
                      className="h-20 w-20 flex-shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground rounded-none flex flex-col items-center justify-center p-0 shadow-lg shadow-primary/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      title="Agregar Nuevo Cliente"
                    >
                      <PlusCircle className="w-6 h-6" />
                      <span className="text-[8px] font-black uppercase tracking-tighter mt-1">NUEVO</span>
                    </Button>
                  )}
                />
                <DialogContent className="sm:max-w-3xl bg-card border-primary/20 p-12 shadow-[0_0_80px_rgba(0,0,0,0.6)] border-l-8 border-l-primary overflow-y-auto max-h-[90vh]">
                  <DialogHeader className="space-y-4 mb-8">
                    <div className="flex items-center gap-6">
                      <div className="p-4 bg-primary/10 rounded-sm border border-primary/20 shrink-0">
                        <PlusCircle className="w-10 h-10 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <DialogTitle className="text-3xl md:text-4xl font-black uppercase text-foreground tracking-tighter leading-tight mb-1 truncate">Nuevo Cliente</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-black opacity-70">Registro instantáneo bajo estética Innovar</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-primary uppercase tracking-widest">Nombre Completo</label>
                        <Input
                          placeholder="Ej: Carlos Mario Velásquez"
                          className="h-14 bg-background border-border/40 text-lg font-bold focus-visible:ring-primary rounded-none"
                          value={newClientData.name}
                          onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-primary uppercase tracking-widest">Correo Electrónico</label>
                        <Input
                          placeholder="carlos@correo.com"
                          className="h-14 bg-background border-border/40 font-bold focus-visible:ring-primary rounded-none"
                          value={newClientData.email}
                          onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                        />
                      </div>
                    </div>
                    <WhatsAppField
                      countries={DEFAULT_COUNTRIES}
                      onChange={(full) => setNewClientData({ ...newClientData, whatsapp_phone: full })}
                      initialValue={newClientData.whatsapp_phone}
                      label="WhatsApp de contacto oficial"
                    />
                    <div className="pt-4">
                      <Button
                        onClick={handleCreateClient}
                        disabled={isCreatingClient || !newClientData.name || newClientData.whatsapp_phone.length < 5}
                        className="w-full h-20 bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 rounded-none hover:translate-y-[-2px] active:translate-y-[0px] transition-all"
                      >
                        {isCreatingClient ? (
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-6 h-6 animate-spin" />
                            <span>PROCESANDO...</span>
                          </div>
                        ) : "REGISTRAR Y SELECCIONAR CLIENTE"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isFocused && <div className="space-y-2 max-h-80 overflow-y-auto px-2">
              {isSearching ? (
                <div className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Consultando base de datos...</p>
                </div>
              ) : clients.map(c => (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className="flex items-center justify-between p-6 bg-card hover:bg-primary/5 border border-border/10 hover:border-primary/30 rounded-none cursor-pointer group transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted/50 rounded-sm group-hover:bg-primary/10 transition-colors">
                      <User className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5 capitalize">{c.email || 'Sin email'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              ))}
              {clientSearch.trim().length > 0 && clients.length === 0 && !isSearching && (
                <div className="text-center py-12 space-y-4">
                  <p className="text-muted-foreground text-sm">No encontramos resultados para su búsqueda.</p>
                  <Button
                    onClick={() => navigate('/leads/new')}
                    className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-bold uppercase tracking-widest h-12 px-8 rounded-none"
                  >
                    Registrar nuevo lead
                  </Button>
                </div>
              )}
            </div>}
          </div>
        )}
      </div>

      <div className="flex justify-end max-w-2xl mx-auto pt-12">
        <Button
          disabled={!selectedClient}
          onClick={onNext}
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold uppercase tracking-widest h-14 px-12 rounded-none group shadow-2xl disabled:opacity-30 transition-all duration-500"
        >
          Siguiente paso <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </motion.div>
  );
}

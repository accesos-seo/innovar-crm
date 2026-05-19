import * as React from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';

export interface QuotationItemData {
  id: string;
  category: string;
  calculatedTotal: number;
  configuration: any;
}

export interface QuotationClient {
  id: string;
  name: string;
  email?: string;
  whatsapp_phone?: string;
}

const INITIAL_ITEMS: QuotationItemData[] = [
  { id: 'initial-cocina', category: 'cocina', calculatedTotal: 0, configuration: {} },
  { id: 'initial-closet', category: 'closet', calculatedTotal: 0, configuration: {} },
  { id: 'initial-puerta', category: 'puerta', calculatedTotal: 0, configuration: {} },
  { id: 'initial-tv-center', category: 'tv_center', calculatedTotal: 0, configuration: {} },
  { id: 'initial-herrajes', category: 'herrajes', calculatedTotal: 0, configuration: {} },
  { id: 'initial-especiales', category: 'especiales', calculatedTotal: 0, configuration: {} },
];

export function useQuotationBuilder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClientId = searchParams.get('client_id');
  const initialType = searchParams.get('type');

  const [currentStep, setCurrentStep] = React.useState(initialClientId ? 2 : 1);
  const [isInitializingContext, setIsInitializingContext] = React.useState(!!initialClientId);
  const [leadContext, setLeadContext] = React.useState<any>(null);
  const [isContextExpanded, setIsContextExpanded] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("cocina");
  const [items, setItems] = React.useState<QuotationItemData[]>(INITIAL_ITEMS);

  const [transportDisplay, setTransportDisplay] = React.useState<string>("0");
  const [discountDisplay, setDiscountDisplay] = React.useState<string>("0");
  const [transportCost, setTransportCost] = React.useState<number>(0);
  const [discountPercent, setDiscountPercent] = React.useState<number>(0);

  const [selectedClient, setSelectedClient] = React.useState<QuotationClient | null>(null);
  const [clientSearch, setClientSearch] = React.useState("");
  const [clients, setClients] = React.useState<QuotationClient[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isCreatingClient, setIsCreatingClient] = React.useState(false);
  const [newClientData, setNewClientData] = React.useState({ name: '', email: '', whatsapp_phone: '' });

  // Initialize from URL params
  React.useEffect(() => {
    if (initialType) setActiveTab(initialType);

    if (initialClientId && !selectedClient) {
      const fetchClient = async () => {
        setIsInitializingContext(true);
        if (!supabase) { setIsInitializingContext(false); return; }
        const { data, error } = await supabase.from('clients').select('*').eq('id', initialClientId).single();
        if (data && !error) {
          setSelectedClient({ id: data.id, name: data.name, email: data.email, whatsapp_phone: data.whatsapp_phone });
          setLeadContext(data);
          setCurrentStep(2);
        }
        setIsInitializingContext(false);
      };
      fetchClient();
    }
  }, [initialClientId, initialType]);

  // Sync display → numeric
  React.useEffect(() => { setTransportCost(Number(transportDisplay) || 0); }, [transportDisplay]);
  React.useEffect(() => { setDiscountPercent(Number(discountDisplay) || 0); }, [discountDisplay]);

  // Client search
  React.useEffect(() => {
    let isMounted = true;
    const fetchClients = async () => {
      try {
        setIsSearching(true);
        if (!supabase) {
          await new Promise(resolve => setTimeout(resolve, 400));
          if (isMounted) { setClients([]); setIsSearching(false); }
          return;
        }
        const query = supabase
          .from('clients')
          .select('id, name, email, whatsapp_phone');
        const { data, error } = clientSearch.trim().length === 0
          ? await query.order('name').limit(20)
          : await query
              .or(`name.ilike.%${clientSearch}%,email.ilike.%${clientSearch}%,whatsapp_phone.ilike.%${clientSearch}%`)
              .order('name')
              .limit(10);
        if (!isMounted) return;
        if (!error) setClients((data as QuotationClient[]) || []);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };
    const delay = clientSearch.trim().length === 0 ? 0 : 400;
    const timer = setTimeout(fetchClients, delay);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [clientSearch]);

  const totals = React.useMemo(() => {
    const subtotalItems = items.reduce((sum, item) => sum + item.calculatedTotal, 0);
    const discountAmount = subtotalItems * (discountPercent / 100);
    const baseSubtotal = subtotalItems - discountAmount;
    const subtotalWithTransport = baseSubtotal + transportCost;
    const taxes = subtotalWithTransport * 0.19;
    const grandTotal = subtotalWithTransport + taxes;
    return { subtotalItems, discountAmount, baseSubtotal, subtotalWithTransport, taxes, grandTotal };
  }, [items, transportCost, discountPercent]);

  const handleItemDataChange = React.useCallback((id: string, newTotal: number, newConfig: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, calculatedTotal: newTotal, configuration: newConfig } : item));
  }, []);

  const handleTransportCheckbox = (checked: boolean) => {
    setTransportDisplay(checked ? "150000" : "0");
  };

  const handleCreateClient = async () => {
    if (!newClientData.name) { toast.error("El nombre es obligatorio"); return; }
    try {
      setIsCreatingClient(true);
      const { data, error } = await supabase!
        .from('clients')
        .insert([{ name: newClientData.name, email: newClientData.email || null, whatsapp_phone: newClientData.whatsapp_phone || null }])
        .select()
        .single();
      if (error) throw error;
      toast.success("Cliente creado y seleccionado");
      setSelectedClient(data as QuotationClient);
      setIsDialogOpen(false);
      setNewClientData({ name: '', email: '', whatsapp_phone: '' });
      setCurrentStep(2);
    } catch {
      toast.error("Error al crear el cliente");
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleSaveQuotation = async () => {
    if (!selectedClient) { toast.error("Seleccione un cliente"); return; }
    const validItems = items.filter(item => item.calculatedTotal > 0);
    if (validItems.length === 0) { toast.error("Agregue al menos un producto configurado."); return; }

    setIsSaving(true);
    try {
      if (!supabase) { toast.success("Cotización simulada guardada. (Modo Fallback)"); navigate("/quotations"); return; }

      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .insert({
          client_id: selectedClient.id,
          subtotal: totals.subtotalItems,
          discount_type: discountPercent > 0 ? 'percent' : 'none',
          discount_value: discountPercent,
          transport_cost: transportCost,
          total_amount: totals.grandTotal,
          status: 'draft',
          version_number: 1,
          is_locked: false,
          notes: 'Cotización técnica procesada desde parametrizador.'
        })
        .select()
        .single();
      if (quotationError) throw quotationError;

      const { error: itemsError } = await supabase
        .from('quotation_items')
        .insert(validItems.map(item => ({
          quotation_id: quotationData.id,
          product_category: item.category,
          description: `Configuración de ${item.category}`,
          unit_price: item.calculatedTotal,
          quantity: 1,
          calculated_total: item.calculatedTotal,
          configuration: item.configuration
        })));
      if (itemsError) throw itemsError;

      toast.success("Cotización guardada exitosamente.");
      navigate('/quotations');
    } catch (error: any) {
      toast.error(error.message || "Error al guardar cotización.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintPDF = async () => {
    toast.success("Generando previsualización PDF...");
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(24); doc.setTextColor(68, 221, 193);
      doc.text("INNOVAR INTERIOR", 20, 25);
      doc.setFontSize(10); doc.setTextColor(100, 100, 100);
      doc.text("PROPUESTA TÉCNICA COMERCIAL", 20, 32);
      doc.setDrawColor(68, 221, 193); doc.setLineWidth(1);
      doc.line(20, 35, pageWidth - 20, 35);

      doc.setFontSize(12); doc.setTextColor(50, 50, 50);
      doc.text(`Cliente: ${selectedClient?.name || 'Cliente Genérico'}`, 20, 50);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 58);
      doc.text(`Validez: 15 días calendario`, 20, 66);

      doc.setFillColor(240, 240, 240);
      doc.rect(20, 80, pageWidth - 40, 10, 'F');
      doc.setFontSize(10); doc.setTextColor(0, 0, 0);
      doc.text("DESCRIPCIÓN DEL ESPACIO", 25, 86.5);
      doc.text("TOTAL", pageWidth - 45, 86.5, { align: 'right' });

      let y = 100;
      items.filter(i => i.calculatedTotal > 0).forEach((item) => {
        doc.setFontSize(11); doc.setTextColor(50, 50, 50);
        doc.text(item.category.toUpperCase(), 25, y);
        doc.text(`$ ${item.calculatedTotal.toLocaleString()}`, pageWidth - 25, y, { align: 'right' });
        doc.setFontSize(9); doc.setTextColor(120, 120, 120);
        doc.text("Configuración personalizada de ingeniería.", 25, y + 5);
        y += 20;
      });

      y += 10;
      doc.setDrawColor(230, 230, 230);
      doc.line(100, y, pageWidth - 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.text("SUBTOTAL (Inc. Transporte):", 140, y, { align: 'right' });
      doc.text(`$ ${totals.subtotalWithTransport.toLocaleString()}`, pageWidth - 25, y, { align: 'right' });
      y += 8;
      doc.text("IVA (19%):", 140, y, { align: 'right' });
      doc.text(`$ ${totals.taxes.toLocaleString()}`, pageWidth - 25, y, { align: 'right' });
      y += 12;
      doc.setFontSize(16); doc.setTextColor(68, 221, 193);
      doc.text("TOTAL INVERSIÓN:", 140, y, { align: 'right' });
      doc.text(`$ ${totals.grandTotal.toLocaleString()}`, pageWidth - 25, y, { align: 'right' });
      doc.setFontSize(8); doc.setTextColor(180, 180, 180);
      doc.text("Este documento es una previsualización técnica. Sujeto a cambios tras validación física.", 20, 280);
      doc.save("Cotizacion_Innovar_Preview.pdf");
      toast.success("PDF generado correctamente");
    } catch {
      toast.error("Error al generar el PDF");
    }
  };

  return {
    currentStep, setCurrentStep,
    isInitializingContext,
    leadContext,
    isContextExpanded, setIsContextExpanded,
    activeTab, setActiveTab,
    items, setItems,
    transportDisplay, setTransportDisplay,
    discountDisplay, setDiscountDisplay,
    transportCost,
    discountPercent, setDiscountPercent,
    selectedClient, setSelectedClient,
    clientSearch, setClientSearch,
    clients,
    isSearching,
    isSaving,
    isDialogOpen, setIsDialogOpen,
    isCreatingClient,
    newClientData, setNewClientData,
    totals,
    handleItemDataChange,
    handleTransportCheckbox,
    handleCreateClient,
    handleSaveQuotation,
    handlePrintPDF,
    navigate,
  };
}

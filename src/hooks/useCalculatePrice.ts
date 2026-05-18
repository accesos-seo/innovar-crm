import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { supabase } from '@/lib/supabaseClient';

// Servicio para el cálculo dinámico
const fetchCalculation = async (category: string, configuration: any) => {
  console.log('📡 Calling Pricing Engine:', { category, configuration });
  
  // Obtener sesión de Supabase si existe
  let authHeader = {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeader = { 'Authorization': `Bearer ${session.access_token}` };
    }
  } catch (e) {
    console.warn("Could not get supabase session for calculation:", e);
  }

  const response = await fetch('/api/quotations/calculate-item', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...authHeader
    },
    body: JSON.stringify({ category, configuration }),
  });
  
  const data = await response.json();
  console.log('💰 Calculation Result:', data);
  
  if (!response.ok) {
    throw new Error(data.error || 'Error calculando precio');
  }
  
  return data;
};

export const useCalculatePrice = (category: string, currentConfig: any) => {
  // Debounce de 500ms para no saturar el backend mientras el usuario teclea
  const [debouncedConfig] = useDebounce(currentConfig, 500);

  return useQuery({
    queryKey: ['calculatePrice', category, debouncedConfig],
    queryFn: () => fetchCalculation(category, debouncedConfig),
    // Solo se ejecuta si hay configuración válida (ej. metraje > 0)
    enabled: !!debouncedConfig, 
    staleTime: 1000 * 60, // Caché de 1 minuto
    retry: false, // Evitamos bucles pesados en errores de configuración
  });
};

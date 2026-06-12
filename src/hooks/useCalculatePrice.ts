import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';
import { supabase } from '@/lib/supabaseClient';

// Servicio para el cálculo dinámico — Edge Function `calculate-item`.
// El motor de precios vive en Supabase (funciona igual en local y en prod;
// Vercel solo sirve estáticos, el viejo /api/quotations/calculate-item del
// server Express no existe allá).
const fetchCalculation = async (category: string, configuration: any) => {
  console.log('📡 Calling Pricing Engine (EF calculate-item):', { category, configuration });

  // invoke() adjunta automáticamente el apikey y el JWT de la sesión si existe
  const { data, error } = await supabase.functions.invoke('calculate-item', {
    body: { category, configuration },
  });

  if (error) {
    // FunctionsHttpError trae la Response original con el JSON del error
    let message = 'Error calculando precio';
    try {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        message = body?.error || message;
      } else if (error.message) {
        message = error.message;
      }
    } catch {
      if (error.message) message = error.message;
    }
    throw new Error(message);
  }

  console.log('💰 Calculation Result:', data);

  if (!data?.success) {
    throw new Error(data?.error || 'Error calculando precio');
  }

  return data;
};

export const useCalculatePrice = (
  category: string,
  currentConfig: any,
  /** Pasar `false` para suspender la query cuando el formulario no tiene datos mínimos válidos */
  enabledOverride?: boolean
) => {
  // Debounce de 500ms para no saturar el backend mientras el usuario teclea
  const [debouncedConfig] = useDebounce(currentConfig, 500);

  const isEnabled = enabledOverride !== undefined
    ? (enabledOverride && !!debouncedConfig)
    : !!debouncedConfig;

  return useQuery({
    queryKey: ['calculatePrice', category, debouncedConfig],
    queryFn: () => fetchCalculation(category, debouncedConfig),
    enabled: isEnabled,
    staleTime: 1000 * 60,
    retry: false,
  });
};

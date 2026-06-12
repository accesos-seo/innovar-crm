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

  // Si el server responde HTML (SPA fallback / 404), el motor de precios NO está
  // disponible en este host — fallar con mensaje claro en vez de mostrar $0.
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Motor de precios no disponible (HTTP ${response.status}). ` +
      `Verifique que el server corra con 'npm run dev' (server.ts), no con vite preview.`
    );
  }

  const data = await response.json();
  console.log('💰 Calculation Result:', data);

  if (!response.ok) {
    throw new Error(data.error || 'Error calculando precio');
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

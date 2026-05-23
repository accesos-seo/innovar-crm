import { Clock, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRequestReactivation } from '@/hooks/quotations/useRequestReactivation';

interface Props {
  token: string;
}

export function QuotationExpiredView({ token }: Props) {
  const req = useRequestReactivation();

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-7 sm:p-9 text-center space-y-5">
      <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
        <Clock className="w-7 h-7 text-orange-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-900">Esta cotización venció</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          La propuesta ya no está vigente, pero podemos prepararte una nueva con los precios
          actualizados. Pedí una reactivación y un asesor te contacta hoy mismo.
        </p>
      </div>

      {req.isSuccess ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          <span>Pedido enviado. Tu asesor te contactará pronto.</span>
        </div>
      ) : (
        <Button
          size="lg"
          className="bg-orange-600 hover:bg-orange-700 text-white"
          disabled={req.isPending}
          onClick={() => req.mutate({ token })}
        >
          {req.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Solicitar nueva cotización
            </>
          )}
        </Button>
      )}
    </div>
  );
}

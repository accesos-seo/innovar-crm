import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  newToken: string;
}

const AUTO_REDIRECT_SECONDS = 4;

export function QuotationRedirectView({ newToken }: Props) {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          navigate(`/cotizacion/${newToken}`, { replace: true });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [newToken, navigate]);

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-7 sm:p-9 text-center space-y-5">
      <div className="mx-auto w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
        <RefreshCw className="w-7 h-7 text-blue-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-gray-900">Esta cotización fue actualizada</h2>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Tu asesor preparó una versión más nueva basada en tu feedback. Te llevamos a la
          vigente en {secondsLeft} segundo{secondsLeft === 1 ? '' : 's'}.
        </p>
      </div>
      <Button
        size="lg"
        className="bg-blue-600 hover:bg-blue-700 text-white"
        onClick={() => navigate(`/cotizacion/${newToken}`, { replace: true })}
      >
        Ir a la versión vigente
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

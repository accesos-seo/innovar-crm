import { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UnlockQuotationModal } from './UnlockQuotationModal';
import type { UserRole } from '@/types/auth';

interface Props {
  quotationId: string;
  isLocked: boolean;
  currentUserRole: UserRole | null | undefined;
}

const ADMIN_ROLES: UserRole[] = ['admin', 'super_admin'];

export function QuotationLockBadge({ quotationId, isLocked, currentUserRole }: Props) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const canUnlock = currentUserRole ? ADMIN_ROLES.includes(currentUserRole) : false;

  if (!isLocked) {
    return (
      <Badge variant="outline" className="gap-1 text-gray-500 border-gray-300">
        <Unlock className="w-3 h-3" />
        Editable
      </Badge>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger>
            <Badge className="gap-1 bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
              <Lock className="w-3 h-3" />
              Bloqueada
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Esta cotización se bloqueó al enviarse al cliente.
          </TooltipContent>
        </Tooltip>
        {canUnlock && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            onClick={() => setUnlockOpen(true)}
          >
            Desbloquear
          </Button>
        )}
      </div>
      <UnlockQuotationModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        quotationId={quotationId}
      />
    </>
  );
}

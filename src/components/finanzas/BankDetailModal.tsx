import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PrimaryButton } from '@/components/shared/PrimaryButton';
import { Loader2 } from 'lucide-react';

const BANK_OPTIONS = [
  { value: 'bancolombia', label: 'Bancolombia' },
  { value: 'banco_de_bogota', label: 'Banco de Bogotá' },
  { value: 'banco_occidente', label: 'Banco Occidente' },
  { value: 'banco_caja_social', label: 'Banco Caja Social' },
  { value: 'bbva', label: 'BBVA' },
  { value: 'santander', label: 'Santander' },
  { value: 'citibank', label: 'Citibank' },
  { value: 'banco_av_villas', label: 'Banco AV Villas' },
  { value: 'banco_popular', label: 'Banco Popular' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'otro', label: 'Otro' },
];

const bankDetailSchema = z.object({
  bank_name: z
    .string()
    .min(1, 'Selecciona un banco')
    .min(3, 'Nombre del banco inválido'),
  account_number: z
    .string()
    .min(1, 'Número de cuenta requerido')
    .regex(/^\d+$/, 'Solo dígitos')
    .min(8, 'Mínimo 8 dígitos')
    .max(20, 'Máximo 20 dígitos'),
  account_type: z
    .enum(['ahorro', 'corriente'])
    .refine((val) => val, { message: 'Selecciona tipo de cuenta' }),
  holder_name: z.string().min(1, 'Nombre del titular requerido').min(3, 'Mínimo 3 caracteres'),
  holder_id: z
    .string()
    .min(1, 'Cédula o NIT requerido')
    .regex(/^\d+$/, 'Solo dígitos')
    .min(8, 'Cédula debe tener al menos 8 dígitos')
    .max(11, 'Cédula máximo 11 dígitos'),
  nequi_phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?57\d{9,10}$/.test(val.replace(/\s+/g, '')), {
      message: 'Teléfono Nequi inválido',
    }),
  daviplata_phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\+?57\d{9,10}$/.test(val.replace(/\s+/g, '')), {
      message: 'Teléfono Daviplata inválido',
    }),
});

type BankDetailFormValues = z.infer<typeof bankDetailSchema>;

interface BankDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BankDetailFormValues) => Promise<void>;
  isLoading?: boolean;
}

export function BankDetailModal({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: BankDetailModalProps) {
  const form = useForm<BankDetailFormValues>({
    resolver: zodResolver(bankDetailSchema),
    defaultValues: {
      bank_name: '',
      account_number: '',
      account_type: 'ahorro',
      holder_name: '',
      holder_id: '',
      nequi_phone: '',
      daviplata_phone: '',
    },
  });

  const handleSubmit = async (data: BankDetailFormValues) => {
    await onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-none border-border/20">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold uppercase">
            Agregar Datos Bancarios
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            {/* Banco */}
            <FormField
              control={form.control}
              name="bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                    Banco *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                        <SelectValue placeholder="Selecciona un banco" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-sm border-border/20 shadow-xl">
                      {BANK_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="font-medium">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Número de cuenta */}
            <FormField
              control={form.control}
              name="account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                    Número de Cuenta *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. 12345678901234"
                      type="text"
                      inputMode="numeric"
                      className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo de Cuenta */}
            <FormField
              control={form.control}
              name="account_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                    Tipo de Cuenta *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full !h-12 rounded-none border-border/50 bg-background font-bold">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="rounded-sm border-border/20 shadow-xl">
                      <SelectItem value="ahorro" className="font-medium">
                        Ahorro
                      </SelectItem>
                      <SelectItem value="corriente" className="font-medium">
                        Corriente
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Titular */}
            <FormField
              control={form.control}
              name="holder_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                    Titular de la Cuenta *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. Juan Pérez García"
                      className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cédula */}
            <FormField
              control={form.control}
              name="holder_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest">
                    Cédula o NIT del Titular *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. 12345678"
                      type="text"
                      inputMode="numeric"
                      className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nequi (opcional) */}
            <FormField
              control={form.control}
              name="nequi_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Nequi (Celular)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. +573001234567"
                      type="tel"
                      className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold"
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground italic">Dejar vacío si no se usa.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Daviplata (opcional) */}
            <FormField
              control={form.control}
              name="daviplata_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Daviplata (Celular)
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej. +573001234567"
                      type="tel"
                      className="h-12 rounded-none border-border/50 bg-background/50 focus:bg-background font-bold"
                    />
                  </FormControl>
                  <p className="text-[10px] text-muted-foreground italic">Dejar vacío si no se usa.</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex gap-3 pt-6 border-t border-border/10">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-12 rounded-none font-bold uppercase text-xs flex-1"
              >
                Cancelar
              </Button>
              <PrimaryButton
                type="submit"
                label="Agregar"
                disabled={isLoading}
                className="flex-1 h-12 rounded-none"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              </PrimaryButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SystemDictionaryEntry, SystemCategory } from "@/types/database";
import { formatSentenceCase } from "@/lib/format-utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  category: z.enum(['BUCKET', 'EDGE_FUNCTION', 'DB_TRIGGER', 'CRON_JOB']),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  description: z.string().min(10, "La descripción debe ser más detallada"),
  trigger_event: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof formSchema>;

interface DictionaryFormProps {
  initialData?: Partial<SystemDictionaryEntry> | null;
  onSubmit: (values: FormValues) => Promise<void>;
  isLoading?: boolean;
}

export function DictionaryForm({ initialData, onSubmit, isLoading }: DictionaryFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: initialData?.category || 'EDGE_FUNCTION',
      name: initialData?.name || "",
      description: initialData?.description || "",
      trigger_event: initialData?.trigger_event || "",
      status: initialData?.status || 'active',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {formatSentenceCase("Categoría")}
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rounded-none border-border/30 h-11 font-bold">
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="BUCKET">Bucket (Storage)</SelectItem>
                    <SelectItem value="EDGE_FUNCTION">Edge Function</SelectItem>
                    <SelectItem value="DB_TRIGGER">Database Trigger</SelectItem>
                    <SelectItem value="CRON_JOB">Cron Job (Scheduler)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {formatSentenceCase("Estado")}
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="rounded-none border-border/30 h-11 font-bold">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="inactive">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {formatSentenceCase("Nombre del Proceso / Recurso")}
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="ej. send-whatsapp-reminder" 
                  className="rounded-none border-border/30 h-11 font-bold bg-background/50" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {formatSentenceCase("Descripción Detallada")}
              </FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Describe qué hace este proceso..." 
                  className="rounded-none border-border/30 min-h-[120px] font-medium bg-background/50" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="trigger_event"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {formatSentenceCase("Evento Detonador (Trigger)")}
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="ej. AFTER INSERT en tabla clients" 
                  className="rounded-none border-border/30 h-11 font-bold bg-background/50" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-4 flex justify-end gap-3">
          <Button 
            type="submit" 
            disabled={isLoading}
            className="rounded-none font-bold px-8 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[150px]"
          >
            {isLoading ? "Guardando..." : "Guardar Registro"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import { Request, Response } from 'express';
import { PricingService } from '../services/pricing.service';
import { CalculateItemRequestSchema, SaveQuotationSchema } from '../../src/schemas/quotation.schema';
import { supabase as defaultSupabase } from '../../src/lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

export const calculateItemTotal = async (req: Request, res: Response) => {
  try {
    // 1. Validar la petición (asegura que el JSON esté bien formado)
    const { category, configuration } = CalculateItemRequestSchema.parse(req.body);
    const authHeader = req.headers.authorization;

    // 2. Cliente Supabase (con JWT si existe, para RLS en catálogo)
    const supabase = authHeader 
      ? createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!, {
          global: { headers: { Authorization: authHeader } },
        })
      : defaultSupabase;

    // 3. Derivar al motor de cálculo según la categoría
    let calculationResult: any;

    switch (category) {
      case 'cocina':
        // Motor completo: kitchen.engine.ts
        // Doc: cotizadores/MOTOR_COCINAS.md
        calculationResult = await PricingService.calculateKitchen(configuration, supabase);
        break;

      case 'puertas':
        calculationResult = await PricingService.calculateDoors(configuration, supabase);
        break;

      // Próximas categorías — replicar este patrón:
      // case 'closet':   calculationResult = await PricingService.calculateCloset(configuration, supabase); break;
      // case 'tv_center': calculationResult = await PricingService.calculateTVCenter(configuration, supabase); break;
      // case 'mesones':  calculationResult = await PricingService.calculateMesones(configuration, supabase); break;
      // case 'puertas_interiores': calculationResult = await PricingService.calculatePuertasInteriores(configuration, supabase); break;

      default:
        return res.status(400).json({
          success: false,
          error: `Categoría '${category}' no soportada aún`,
        });
    }

    // 4. Retornar resultado completo al frontend
    res.status(200).json({
      success: true,
      data: {
        calculated_total: calculationResult.subtotal,
        metrajeResultante: calculationResult.metrajeEfectivo,
        desglose:          calculationResult.desglose     ?? null,
        precios_usados:    calculationResult.preciosUsados ?? null,
      },
    });

  } catch (error: any) {
    console.error("Error en motor de precios:", error);
    res.status(400).json({ success: false, error: error.message });
  }
};

export const saveQuotation = async (req: Request, res: Response) => {
  try {
    // 1. Validación estricta con Zod
    const validData = SaveQuotationSchema.parse(req.body);
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, error: "No autorizado. Sesión requerida." });
    }

    // 2. Cliente Supabase con el JWT del usuario para respetar RLS
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 3. Obtener Usuario creador
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Error obteniendo usuario:", userError);
      return res.status(401).json({ success: false, error: "Sesión inválida" });
    }

    console.log("📝 Generating quotation for client:", validData.client_id, "by user:", user.email);

    // 4. Preparar datos de cabecera (Tabla quotations)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    // 5. Insertar la Cabecera
    const { data: newQuotation, error: headerError } = await supabase
      .from('quotations')
      .insert({
        client_id: validData.client_id,
        status: 'draft', 
        subtotal: validData.subtotal,
        total_amount: validData.total_amount,
        discount_type: validData.discount_type,
        discount_value: validData.discount_value,
        transport_cost: validData.transport_cost,
        version_number: 1,
        is_locked: false,
        valid_until: validUntil.toISOString()
      })
      .select('id')
      .single();

    if (headerError || !newQuotation) {
      console.error("Error insertando cabecera de cotización:", JSON.stringify(headerError, null, 2));
      throw new Error(`Error en DB (Cabecera): ${headerError?.message || 'Fallo al generar la cotización'}`);
    }

    // 6. Insertar los Items (Tabla quotation_items) - SIN base_catalog_id NI calculated_total
    const itemsToInsert = validData.items.map(item => ({
      quotation_id: newQuotation.id,
      description: `Configuración técnica: ${item.product_category.toUpperCase()}`,
      product_category: item.product_category,
      quantity: 1,
      unit_price: item.calculated_total, // Mantenemos unit_price como el valor calculado del item
      configuration: item.configuration // JSONB trazabilidad técnica
    }));

    const { error: itemsError } = await supabase
      .from('quotation_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("Error insertando items de cotización:", JSON.stringify(itemsError, null, 2));
      // Intentar limpiar la cabecera huérfana (opcional, pero recomendado por integridad)
      await supabase.from('quotations').delete().eq('id', newQuotation.id);
      throw new Error(`Error en DB (Items): ${itemsError.message}`);
    }

    // 7. Éxito: Responder al Frontend
    res.status(201).json({
      success: true,
      message: "Cotización guardada exitosamente con sus ítems detallados",
      data: { quotation_id: newQuotation.id }
    });

  } catch (error: any) {
    console.error("Error en saveQuotation:", error);
    if (error.errors) {
      return res.status(400).json({ success: false, error: "Datos inválidos", details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

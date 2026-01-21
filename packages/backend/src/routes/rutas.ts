import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

export const rutasRouter = Router();

const estacionSchema = z.object({
  nombre: z.string().min(1),
  tag: z.string().min(1),
  orden: z.number().int().positive(),
  tiempo_esperado_seg: z.number().int().nonnegative(),
  tolerancia_seg: z.number().int().positive().default(300)
});

const crearRutaSchema = z.object({
  nombre: z.string().min(2),
  descripcion: z.string().optional(),
  frecuencia_min: z.number().int().positive(),
  estaciones: z.array(estacionSchema).min(2, 'Una ruta debe tener al menos 2 estaciones')
});

// GET /api/rutas - Listar rutas
rutasRouter.get('/', async (req, res, next) => {
  try {
    const { activa } = req.query;

    let query = supabase
      .from('rutas')
      .select(`
        *,
        estaciones (*)
      `)
      .order('nombre');

    if (activa !== undefined) {
      query = query.eq('activa', activa === 'true');
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    // Ordenar estaciones por orden
    const rutasOrdenadas = data?.map(ruta => ({
      ...ruta,
      estaciones: ruta.estaciones?.sort((a: any, b: any) => a.orden - b.orden)
    }));

    res.json({ success: true, data: rutasOrdenadas });
  } catch (error) {
    next(error);
  }
});

// GET /api/rutas/:id - Obtener ruta con estaciones
rutasRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('rutas')
      .select(`
        *,
        estaciones (*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Ruta no encontrada', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    // Ordenar estaciones
    data.estaciones = data.estaciones?.sort((a: any, b: any) => a.orden - b.orden);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/rutas - Crear ruta con estaciones
rutasRouter.post('/', async (req, res, next) => {
  try {
    const validacion = crearRutaSchema.safeParse(req.body);

    if (!validacion.success) {
      throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const { nombre, descripcion, frecuencia_min, estaciones } = validacion.data;

    // Verificar que orden de estaciones sea correcto
    const ordenesUnicos = new Set(estaciones.map(e => e.orden));
    if (ordenesUnicos.size !== estaciones.length) {
      throw new AppError('Los órdenes de estaciones deben ser únicos', 400);
    }

    // Crear ruta
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas')
      .insert({
        nombre,
        descripcion,
        frecuencia_min,
        activa: true
      })
      .select()
      .single();

    if (rutaError) throw new AppError(rutaError.message, 500, 'DB_ERROR');

    // Crear estaciones
    const estacionesConRuta = estaciones.map(e => ({
      ...e,
      ruta_id: ruta.id,
      activa: true
    }));

    const { data: estacionesCreadas, error: estacionesError } = await supabase
      .from('estaciones')
      .insert(estacionesConRuta)
      .select();

    if (estacionesError) {
      // Rollback: eliminar ruta si fallan estaciones
      await supabase.from('rutas').delete().eq('id', ruta.id);
      throw new AppError(estacionesError.message, 500, 'DB_ERROR');
    }

    res.status(201).json({
      success: true,
      data: {
        ...ruta,
        estaciones: estacionesCreadas?.sort((a, b) => a.orden - b.orden)
      }
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rutas/:id - Actualizar ruta
rutasRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, frecuencia_min, activa } = req.body;

    const { data, error } = await supabase
      .from('rutas')
      .update({
        nombre,
        descripcion,
        frecuencia_min,
        activa,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Ruta no encontrada', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/rutas/:id/estaciones - Agregar estación a ruta
rutasRouter.post('/:id/estaciones', async (req, res, next) => {
  try {
    const { id } = req.params;
    const validacion = estacionSchema.safeParse(req.body);

    if (!validacion.success) {
      throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    // Verificar que la ruta existe
    const { data: ruta } = await supabase
      .from('rutas')
      .select('id')
      .eq('id', id)
      .single();

    if (!ruta) {
      throw new AppError('Ruta no encontrada', 404);
    }

    const { data, error } = await supabase
      .from('estaciones')
      .insert({
        ...validacion.data,
        ruta_id: id,
        activa: true
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/rutas/:rutaId/estaciones/:estacionId - Actualizar estación
rutasRouter.put('/:rutaId/estaciones/:estacionId', async (req, res, next) => {
  try {
    const { rutaId, estacionId } = req.params;
    const { nombre, tag, orden, tiempo_esperado_seg, tolerancia_seg, activa } = req.body;

    const { data, error } = await supabase
      .from('estaciones')
      .update({
        nombre,
        tag,
        orden,
        tiempo_esperado_seg,
        tolerancia_seg,
        activa,
        updated_at: new Date().toISOString()
      })
      .eq('id', estacionId)
      .eq('ruta_id', rutaId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Estación no encontrada', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

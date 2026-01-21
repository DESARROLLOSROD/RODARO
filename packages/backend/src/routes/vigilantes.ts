import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

export const vigilantesRouter = Router();

const crearVigilanteSchema = z.object({
  nombre: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  numero_empleado: z.string().optional()
});

// GET /api/vigilantes - Listar vigilantes
vigilantesRouter.get('/', async (req, res, next) => {
  try {
    const { activo } = req.query;

    let query = supabase
      .from('vigilantes')
      .select('*')
      .order('nombre');

    if (activo !== undefined) {
      query = query.eq('activo', activo === 'true');
    }

    const { data, error } = await query;

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// GET /api/vigilantes/:id - Obtener vigilante por ID
vigilantesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vigilantes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Vigilante no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/vigilantes - Crear vigilante
vigilantesRouter.post('/', async (req, res, next) => {
  try {
    const validacion = crearVigilanteSchema.safeParse(req.body);

    if (!validacion.success) {
      throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
    }

    const { data, error } = await supabase
      .from('vigilantes')
      .insert({
        nombre: validacion.data.nombre,
        numero_empleado: validacion.data.numero_empleado,
        activo: true
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500, 'DB_ERROR');

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/vigilantes/:id - Actualizar vigilante
vigilantesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, numero_empleado, activo } = req.body;

    const { data, error } = await supabase
      .from('vigilantes')
      .update({
        nombre,
        numero_empleado,
        activo,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Vigilante no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vigilantes/:id - Desactivar vigilante (soft delete)
vigilantesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('vigilantes')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Vigilante no encontrado', 404);
      }
      throw new AppError(error.message, 500, 'DB_ERROR');
    }

    res.json({ success: true, data, message: 'Vigilante desactivado' });
  } catch (error) {
    next(error);
  }
});

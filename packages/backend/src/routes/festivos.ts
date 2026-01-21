import { Router } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

export const festivosRouter = Router();

const crearFestivoSchema = z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    descripcion: z.string().optional()
});

// GET /api/festivos - Listar festivos
festivosRouter.get('/', async (req, res, next) => {
    try {
        const { year } = req.query;

        let query = supabase
            .from('festivos')
            .select('*')
            .order('fecha', { ascending: true });

        if (year) {
            query = query.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`);
        }

        const { data, error } = await query;

        if (error) throw new AppError(error.message, 500, 'DB_ERROR');

        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// POST /api/festivos - Crear festivo
festivosRouter.post('/', async (req, res, next) => {
    try {
        const validacion = crearFestivoSchema.safeParse(req.body);

        if (!validacion.success) {
            throw new AppError(validacion.error.errors[0].message, 400, 'VALIDATION_ERROR');
        }

        const { data, error } = await supabase
            .from('festivos')
            .insert(validacion.data)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new AppError('Ya existe un festivo en esta fecha', 400, 'DUPLICATE_ERROR');
            }
            throw new AppError(error.message, 500, 'DB_ERROR');
        }

        res.status(201).json({ success: true, data });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/festivos/:id - Eliminar festivo
festivosRouter.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('festivos')
            .delete()
            .eq('id', id);

        if (error) throw new AppError(error.message, 500, 'DB_ERROR');

        res.json({ success: true, message: 'Festivo eliminado' });
    } catch (error) {
        next(error);
    }
});

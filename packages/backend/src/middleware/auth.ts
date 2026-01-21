import { Request, Response, NextFunction } from 'express';
import { supabaseAuth } from '../config/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!supabaseAuth) {
      return res.status(500).json({
        success: false,
        error: 'Configuración de autenticación incompleta'
      });
    }

    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'OPERADOR'
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno de autenticación'
    });
  }
};

// Middleware especial para el agente local
export const agentAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const agentToken = req.headers['x-agent-token'];
  const expectedToken = process.env.AGENT_API_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      success: false,
      error: 'Token de agente no configurado en el servidor'
    });
  }

  if (agentToken !== expectedToken) {
    return res.status(401).json({
      success: false,
      error: 'Token de agente inválido'
    });
  }

  req.user = {
    id: 'agent',
    role: 'AGENT'
  };

  next();
};

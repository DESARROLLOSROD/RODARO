import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? `Bearer ${session.access_token}` : '';
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = await getAuthHeader();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error en la petición');
  }

  return data;
}

// API de Vigilantes
export const vigilantesApi = {
  list: (activo?: boolean) =>
    fetchApi<{ success: boolean; data: any[] }>(
      `/vigilantes${activo !== undefined ? `?activo=${activo}` : ''}`
    ),
  get: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/vigilantes/${id}`),
  create: (data: { nombre: string; numero_empleado?: string }) =>
    fetchApi<{ success: boolean; data: any }>('/vigilantes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: any) =>
    fetchApi<{ success: boolean; data: any }>(`/vigilantes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/vigilantes/${id}`, { method: 'DELETE' })
};

// API de Rutas
export const rutasApi = {
  list: (activa?: boolean) =>
    fetchApi<{ success: boolean; data: any[] }>(
      `/rutas${activa !== undefined ? `?activa=${activa}` : ''}`
    ),
  get: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/rutas/${id}`),
  create: (data: any) =>
    fetchApi<{ success: boolean; data: any }>('/rutas', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  update: (id: string, data: any) =>
    fetchApi<{ success: boolean; data: any }>(`/rutas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
};

// API de Turnos
export const turnosApi = {
  list: (params?: { vigilante_id?: string; fecha_inicio?: string; fecha_fin?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ success: boolean; data: any[] }>(`/turnos${query ? `?${query}` : ''}`);
  },
  get: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/turnos/${id}`),
  create: (data: any) =>
    fetchApi<{ success: boolean; data: any }>('/turnos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getResumen: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/turnos/${id}/resumen`)
};

// API de Rondas
export const rondasApi = {
  list: (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return fetchApi<{ success: boolean; data: any[]; pagination: any }>(
      `/rondas${query ? `?${query}` : ''}`
    );
  },
  get: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/rondas/${id}`),
  getByTurno: (turnoId: string) =>
    fetchApi<{ success: boolean; data: any[] }>(`/rondas/turno/${turnoId}`)
};

// API de Reportes
export const reportesApi = {
  diario: (fecha: string) =>
    fetchApi<{ success: boolean; data: any }>(`/reportes/diario?fecha=${fecha}`),
  porVigilante: (id: string, fechaInicio: string, fechaFin: string) =>
    fetchApi<{ success: boolean; data: any }>(
      `/reportes/vigilante/${id}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`
    ),
  porRuta: (id: string, fechaInicio: string, fechaFin: string) =>
    fetchApi<{ success: boolean; data: any }>(
      `/reportes/ruta/${id}?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`
    ),
  noRealizadas: (params: { fecha_inicio: string; fecha_fin: string; vigilante_id?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ success: boolean; data: any[] }>(`/reportes/no-realizadas?${query}`);
  },
  estadisticas: (params: { mes?: string; fecha_inicio?: string; fecha_fin?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchApi<{ success: boolean; data: any[]; periodo: any }>(`/reportes/estadisticas?${query}`);
  }
};

// API de Festivos
export const festivosApi = {
  list: (year?: string) =>
    fetchApi<{ success: boolean; data: any[] }>(`/festivos${year ? `?year=${year}` : ''}`),
  create: (data: { fecha: string; descripcion?: string }) =>
    fetchApi<{ success: boolean; data: any }>('/festivos', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/festivos/${id}`, { method: 'DELETE' })
};

// API de Eventos
export const eventosApi = {
  descarga: (data: { lector_id: string; eventos: any[]; timestamp_descarga: string }) =>
    fetchApi<{
      success: boolean;
      procesados: number;
      duplicados: number;
      rondas_afectadas: number;
    }>('/eventos/descarga', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

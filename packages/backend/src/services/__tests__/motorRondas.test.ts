import { procesarEventos } from '../motorRondas';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('motorRondas', () => {
  let mockFrom: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom = supabase.from as jest.Mock;
  });

  const createMockQuery = (data: any, error: any = null) => {
    const query: any = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      then: (resolve: any) => resolve({ data, error }),
    };
    return query;
  };

  const mockEstaciones = [
    {
      id: 'est1', ruta_id: 'ruta1', tag: 'TAG1', orden: 1,
      tiempo_esperado_seg: 0, tolerancia_seg: 300,
      ruta: { frecuencia_min: 120 }
    },
    {
      id: 'est2', ruta_id: 'ruta1', tag: 'TAG2', orden: 2,
      tiempo_esperado_seg: 300, tolerancia_seg: 300,
      ruta: { frecuencia_min: 120 }
    },
  ];

  const mockTurno = {
    id: 'turno1', vigilante_id: 'vig1', ruta_id: 'ruta1',
    inicio: '2024-01-01T08:00:00Z', fin: '2024-01-01T20:00:00Z'
  };

  it('debería retornar 0 rondas afectadas si no hay eventos', async () => {
    const resultado = await procesarEventos([]);
    expect(resultado.rondasAfectadas).toBe(0);
  });

  it('debería procesar un inicio de ronda correctamente (E1)', async () => {
    const mockEventos = [
      { id: 'ev1', tag: 'TAG1', fecha_hora: '2024-01-01T10:00:00Z', procesado: false },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estaciones') return createMockQuery(mockEstaciones);
      if (table === 'turnos') return createMockQuery([mockTurno]);
      if (table === 'rondas') {
        const query = createMockQuery([]);
        query.insert = jest.fn().mockReturnThis();
        query.select = jest.fn().mockReturnThis();
        query.single = jest.fn().mockResolvedValue({ data: { id: 'ronda1' }, error: null });
        return query;
      }
      return createMockQuery(null);
    });

    const resultado = await procesarEventos(mockEventos);

    expect(resultado.errores).toEqual([]);
    expect(resultado.rondasAfectadas).toBe(1);
  });

  it('debería permitir que una ronda cierre cruzando el límite de ventana (duración corta)', async () => {
    // Frecuencia 120min. Ventana 0: 08:00-10:00. Ventana 1: 10:00-12:00.
    // Inicio: 09:55 (Ventana 0). Fin: 10:10 (Ventana 1). Duración: 15 min.
    const mockEventos = [
      { id: 'ev_fin', tag: 'TAG1', fecha_hora: '2024-01-01T10:10:00Z', procesado: false },
    ];

    const mockRondaAbierta = {
      id: 'ronda_abierta',
      turno_id: 'turno1',
      ruta_id: 'ruta1',
      inicio: '2024-01-01T09:55:00Z',
      ventana_inicio: '2024-01-01T08:00:00Z',
      ventana_fin: '2024-01-01T10:00:00Z'
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estaciones') return createMockQuery(mockEstaciones);
      if (table === 'turnos') return createMockQuery([mockTurno]);
      if (table === 'rondas') {
        // Mock para buscar rondas abiertas
        const query = createMockQuery([mockRondaAbierta]);
        query.update = jest.fn().mockReturnThis();
        return query;
      }
      if (table === 'ronda_detalle') {
        const query = createMockQuery(null);
        query.select = jest.fn().mockReturnThis();
        query.single = jest.fn().mockResolvedValue({ data: null, error: null });
        return query;
      }
      return createMockQuery(null);
    });

    const resultado = await procesarEventos(mockEventos);

    expect(resultado.errores).toEqual([]);
    // Debería ser un cierre, llamando a finalizarRonda (que hace update en 'rondas')
    const rondasUpdateCall = mockFrom.mock.calls.filter(c => c[0] === 'rondas');
    expect(rondasUpdateCall.length).toBeGreaterThan(0);
  });

  it('debería forzar cierre e iniciar nueva ronda si cruza ventana con duración larga', async () => {
    // Inicio: 08:10 (Ventana 0). Fin: 10:10 (Ventana 1). Duración: 2h.
    // > 50% de 120min (60min).
    const mockEventos = [
      { id: 'ev_nuevo', tag: 'TAG1', fecha_hora: '2024-01-01T10:10:00Z', procesado: false },
    ];

    const mockRondaVieja = {
      id: 'ronda_vieja',
      turno_id: 'turno1',
      ruta_id: 'ruta1',
      inicio: '2024-01-01T08:10:00Z',
      ventana_inicio: '2024-01-01T08:00:00Z',
      ventana_fin: '2024-01-01T10:00:00Z'
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estaciones') return createMockQuery(mockEstaciones);
      if (table === 'turnos') return createMockQuery([mockTurno]);
      if (table === 'rondas') {
        // Primera llamada: buscar abiertas
        // Segunda llamada: verificar si ya existe en ventana actual (10:00-12:00)
        // Tercera: insertar
        const query = createMockQuery([mockRondaVieja]);
        query.gte = jest.fn().mockReturnThis();
        query.lt = jest.fn().mockReturnValue({ data: [] }); // No hay ronda en ventana 1
        query.insert = jest.fn().mockReturnThis();
        query.select = jest.fn().mockReturnThis();
        query.single = jest.fn().mockResolvedValue({ data: { id: 'ronda_nueva' }, error: null });
        query.update = jest.fn().mockReturnThis();
        return query;
      }
      return createMockQuery(null);
    });

    const resultado = await procesarEventos(mockEventos);

    expect(resultado.errores).toEqual([]);
    // Debería haber un update (cierre forzado) y un insert (nueva ronda)
    const rondasCalls = mockFrom.mock.calls.filter(c => c[0] === 'rondas');
    expect(rondasCalls.length).toBeGreaterThan(1);
  });

  it('debería ignorar E1 si es un "rebote" (duplicado muy cercano al cierre)', async () => {
    const mockEventos = [
      { id: 'ev_rebote', tag: 'TAG1', fecha_hora: '2024-01-01T10:01:00Z', procesado: false },
    ];

    const mockUltimaRonda = {
      id: 'ronda_cerrada',
      fin: '2024-01-01T10:00:30Z' // Cerrada hace 30 segundos
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'estaciones') return createMockQuery(mockEstaciones);
      if (table === 'turnos') return createMockQuery([mockTurno]);
      if (table === 'rondas') {
        const query = createMockQuery([]); // No hay abiertas
        query.not = jest.fn().mockReturnThis();
        query.order = jest.fn().mockReturnThis();
        query.limit = jest.fn().mockReturnValue({ data: [mockUltimaRonda] });
        return query;
      }
      return createMockQuery(null);
    });

    const resultado = await procesarEventos(mockEventos);

    expect(resultado.rondasAfectadas).toBe(0);
    expect(resultado.errores[0]).toContain('rebote');
  });
});

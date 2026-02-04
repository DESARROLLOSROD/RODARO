import { procesarEventos } from '../motorRondas';
import { supabase } from '../../config/supabase';

jest.mock('../../config/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
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
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockReturnValue({ select: () => ({ single: () => Promise.resolve({ data: { id: 'new' } }) }) }),
    update: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((res) => res({ data: [], error: null }))
  }
}));

describe('motorRondas', () => {
  it('debería retornar 0 rondas afectadas si no hay eventos', async () => {
    const resultado = await procesarEventos([]);
    expect(resultado.rondasAfectadas).toBe(0);
  });
});

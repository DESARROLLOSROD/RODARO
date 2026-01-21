import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Calendar, Clock } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { turnosApi, vigilantesApi, rutasApi } from '../lib/api';

interface TurnoForm {
  vigilante_id: string;
  ruta_id: string;
  inicio: string;
  fin: string;
}

export default function Turnos() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TurnoForm>({
    vigilante_id: '',
    ruta_id: '',
    inicio: format(new Date(), "yyyy-MM-dd'T'07:00"),
    fin: format(addHours(new Date(), 24), "yyyy-MM-dd'T'07:00")
  });

  const queryClient = useQueryClient();

  const { data: turnosData, isLoading } = useQuery({
    queryKey: ['turnos'],
    queryFn: () => turnosApi.list()
  });

  const { data: vigilantesData } = useQuery({
    queryKey: ['vigilantes', 'activos'],
    queryFn: () => vigilantesApi.list(true)
  });

  const { data: rutasData } = useQuery({
    queryKey: ['rutas', 'activas'],
    queryFn: () => rutasApi.list(true)
  });

  const createMutation = useMutation({
    mutationFn: turnosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      setShowForm(false);
      setForm({
        vigilante_id: '',
        ruta_id: '',
        inicio: format(new Date(), "yyyy-MM-dd'T'07:00"),
        fin: format(addHours(new Date(), 24), "yyyy-MM-dd'T'07:00")
      });
    }
  });

  const turnos = turnosData?.data || [];
  const vigilantes = vigilantesData?.data || [];
  const rutas = rutasData?.data || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      inicio: new Date(form.inicio).toISOString(),
      fin: new Date(form.fin).toISOString()
    });
  };

  const handleInicioChange = (value: string) => {
    const inicio = new Date(value);
    const fin = addHours(inicio, 24);

    setForm({
      ...form,
      inicio: value,
      fin: format(fin, "yyyy-MM-dd'T'HH:mm")
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
          <p className="text-gray-500">Gestión de turnos 24x48</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Turno
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card title="Nuevo Turno (24x48)">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vigilante *
                </label>
                <select
                  value={form.vigilante_id}
                  onChange={(e) => setForm({ ...form, vigilante_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                >
                  <option value="">Seleccionar vigilante</option>
                  {vigilantes.map((v: any) => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ruta *
                </label>
                <select
                  value={form.ruta_id}
                  onChange={(e) => setForm({ ...form, ruta_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                >
                  <option value="">Seleccionar ruta</option>
                  {rutas.map((r: any) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} ({r.frecuencia_min} min)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Inicio del turno *
                </label>
                <input
                  type="datetime-local"
                  value={form.inicio}
                  onChange={(e) => handleInicioChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fin del turno (24 horas después)
                </label>
                <input
                  type="datetime-local"
                  value={form.fin}
                  onChange={(e) => setForm({ ...form, fin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>
            </div>

            {createMutation.error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {(createMutation.error as Error).message}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" isLoading={createMutation.isPending}>
                Crear Turno
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de turnos */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : turnos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vigilante</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ruta</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Inicio</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fin</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((turno: any) => {
                  const ahora = new Date();
                  const inicio = new Date(turno.inicio);
                  const fin = new Date(turno.fin);
                  const esActivo = ahora >= inicio && ahora <= fin;
                  const esFuturo = ahora < inicio;

                  return (
                    <tr key={turno.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-medium text-sm">
                              {turno.vigilante?.nombre?.charAt(0) || '?'}
                            </span>
                          </div>
                          <span className="font-medium">{turno.vigilante?.nombre}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{turno.ruta?.nombre}</td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {format(inicio, "d MMM", { locale: es })}
                          <Clock className="h-4 w-4 ml-2" />
                          {format(inicio, "HH:mm")}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="h-4 w-4" />
                          {format(fin, "d MMM", { locale: es })}
                          <Clock className="h-4 w-4 ml-2" />
                          {format(fin, "HH:mm")}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          esActivo
                            ? 'bg-green-100 text-green-700'
                            : esFuturo
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {esActivo ? 'Activo' : esFuturo ? 'Programado' : 'Finalizado'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No hay turnos registrados</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              Crear primer turno
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

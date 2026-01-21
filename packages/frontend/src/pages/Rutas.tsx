import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { rutasApi } from '../lib/api';

interface EstacionForm {
  id: string;
  nombre: string;
  tag: string;
  orden: number;
  tiempo_esperado_seg: number;
  tolerancia_seg: number;
}

interface RutaForm {
  nombre: string;
  descripcion: string;
  frecuencia_min: number;
  estaciones: EstacionForm[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const createInitialForm = (): RutaForm => ({
  nombre: '',
  descripcion: '',
  frecuencia_min: 120,
  estaciones: [
    { id: generateId(), nombre: '', tag: '', orden: 1, tiempo_esperado_seg: 0, tolerancia_seg: 300 }
  ]
});

export default function Rutas() {
  const [showForm, setShowForm] = useState(false);
  const [expandedRuta, setExpandedRuta] = useState<string | null>(null);
  const [form, setForm] = useState<RutaForm>(createInitialForm);

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['rutas'],
    queryFn: () => rutasApi.list()
  });

  const createMutation = useMutation({
    mutationFn: (data: RutaForm) => {
      // Remove the temporary id before sending to API
      const payload = {
        ...data,
        estaciones: data.estaciones.map(({ id, ...rest }) => rest)
      };
      return rutasApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rutas'] });
      setForm(createInitialForm());
      setShowForm(false);
    }
  });

  const rutas = data?.data || [];

  const addEstacion = useCallback(() => {
    setForm(prev => ({
      ...prev,
      estaciones: [
        ...prev.estaciones,
        {
          id: generateId(),
          nombre: '',
          tag: '',
          orden: prev.estaciones.length + 1,
          tiempo_esperado_seg: 180,
          tolerancia_seg: 300
        }
      ]
    }));
  }, []);

  const removeEstacion = useCallback((index: number) => {
    setForm(prev => {
      if (prev.estaciones.length <= 1) return prev;

      const nuevasEstaciones = prev.estaciones
        .filter((_, i) => i !== index)
        .map((e, i) => ({ ...e, orden: i + 1 }));

      return { ...prev, estaciones: nuevasEstaciones };
    });
  }, []);

  const updateEstacion = useCallback((index: number, field: keyof Omit<EstacionForm, 'id'>, value: string | number) => {
    setForm(prev => {
      const nuevasEstaciones = [...prev.estaciones];
      nuevasEstaciones[index] = { ...nuevasEstaciones[index], [field]: value };
      return { ...prev, estaciones: nuevasEstaciones };
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rutas</h1>
          <p className="text-gray-500">Gestión de rutas y estaciones</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Ruta
        </Button>
      </div>

      {/* Formulario de nueva ruta */}
      {showForm && (
        <Card title="Nueva Ruta">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos de la ruta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la ruta *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frecuencia (minutos) *
                </label>
                <select
                  value={form.frecuencia_min}
                  onChange={(e) => setForm({ ...form, frecuencia_min: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value={120}>120 min (2 horas)</option>
                  <option value={180}>180 min (3 horas)</option>
                </select>
              </div>
            </div>

            {/* Estaciones */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">Estaciones</h4>
                <Button type="button" variant="secondary" size="sm" onClick={addEstacion}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>

              <div className="space-y-3">
                {form.estaciones.map((estacion, index) => (
                  <div key={estacion.id} className="flex gap-3 items-start bg-gray-50 p-3 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">{estacion.orden}</span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Nombre estación"
                        value={estacion.nombre}
                        onChange={(e) => updateEstacion(index, 'nombre', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        required
                      />
                      <input
                        type="text"
                        placeholder="TAG (hex)"
                        value={estacion.tag}
                        onChange={(e) => updateEstacion(index, 'tag', e.target.value.toUpperCase())}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Tiempo esperado (seg)"
                        value={estacion.tiempo_esperado_seg}
                        onChange={(e) => updateEstacion(index, 'tiempo_esperado_seg', parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        min={0}
                      />
                      <input
                        type="number"
                        placeholder="Tolerancia (seg)"
                        value={estacion.tolerancia_seg}
                        onChange={(e) => updateEstacion(index, 'tolerancia_seg', parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        min={1}
                      />
                    </div>

                    {form.estaciones.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEstacion(index)}
                        className="text-red-500"
                      >
                        &times;
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" isLoading={createMutation.isPending}>
                Guardar Ruta
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de rutas */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          </Card>
        ) : rutas.length > 0 ? (
          rutas.map((ruta: any) => (
            <Card key={ruta.id}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedRuta(expandedRuta === ruta.id ? null : ruta.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <MapPin className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{ruta.nombre}</h3>
                    <p className="text-sm text-gray-500">
                      {ruta.estaciones?.length || 0} estaciones | Cada {ruta.frecuencia_min} min
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    ruta.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {ruta.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  {expandedRuta === ruta.id ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Estaciones expandidas */}
              {expandedRuta === ruta.id && ruta.estaciones?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Estaciones:</h4>
                  <div className="space-y-2">
                    {ruta.estaciones.map((est: any) => (
                      <div
                        key={est.id}
                        className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-medium">
                          {est.orden}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{est.nombre}</p>
                          <p className="text-xs text-gray-500">
                            TAG: <code className="bg-gray-200 px-1 rounded">{est.tag}</code>
                            {' | '}
                            Tiempo: {est.tiempo_esperado_seg}s
                            {' | '}
                            Tolerancia: {est.tolerancia_seg}s
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay rutas registradas</p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                Crear primera ruta
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

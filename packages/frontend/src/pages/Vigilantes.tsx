import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, UserCheck, UserX } from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { vigilantesApi } from '../lib/api';

interface VigilanteForm {
  nombre: string;
  numero_empleado: string;
}

export default function Vigilantes() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VigilanteForm>({ nombre: '', numero_empleado: '' });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vigilantes'],
    queryFn: () => vigilantesApi.list()
  });

  const createMutation = useMutation({
    mutationFn: vigilantesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vigilantes'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => vigilantesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vigilantes'] });
      resetForm();
    }
  });

  const vigilantes = data?.data || [];

  const resetForm = () => {
    setForm({ nombre: '', numero_empleado: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (vigilante: any) => {
    setForm({
      nombre: vigilante.nombre,
      numero_empleado: vigilante.numero_empleado || ''
    });
    setEditingId(vigilante.id);
    setShowForm(true);
  };

  const handleToggleActivo = (vigilante: any) => {
    updateMutation.mutate({
      id: vigilante.id,
      data: { ...vigilante, activo: !vigilante.activo }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vigilantes</h1>
          <p className="text-gray-500">Gestión de vigilantes del sistema</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Vigilante
        </Button>
      </div>

      {/* Formulario */}
      {showForm && (
        <Card title={editingId ? 'Editar Vigilante' : 'Nuevo Vigilante'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de empleado
                </label>
                <input
                  type="text"
                  value={form.numero_empleado}
                  onChange={(e) => setForm({ ...form, numero_empleado: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de vigilantes */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : vigilantes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">No. Empleado</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Estado</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {vigilantes.map((vigilante: any) => (
                  <tr key={vigilante.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-primary-600 font-medium text-sm">
                            {vigilante.nombre.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium">{vigilante.nombre}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {vigilante.numero_empleado || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        vigilante.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {vigilante.activo ? (
                          <>
                            <UserCheck className="h-3 w-3" />
                            Activo
                          </>
                        ) : (
                          <>
                            <UserX className="h-3 w-3" />
                            Inactivo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(vigilante)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActivo(vigilante)}
                        >
                          {vigilante.activo ? (
                            <UserX className="h-4 w-4 text-gray-500" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-green-500" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No hay vigilantes registrados</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              Agregar el primero
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

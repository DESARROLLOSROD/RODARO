import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Filter, Eye } from 'lucide-react';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import { rondasApi, vigilantesApi } from '../lib/api';

export default function Rondas() {
  const [filtros, setFiltros] = useState({
    estatus: '',
    vigilante_id: '',
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    fecha_fin: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: rondasData, isLoading } = useQuery({
    queryKey: ['rondas', filtros],
    queryFn: () => rondasApi.list({
      ...filtros,
      limit: '50'
    })
  });

  const { data: vigilantesData } = useQuery({
    queryKey: ['vigilantes'],
    queryFn: () => vigilantesApi.list(true)
  });

  const rondas = rondasData?.data || [];
  const vigilantes = vigilantesData?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rondas</h1>
          <p className="text-gray-500">Listado de rondas procesadas</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha inicio
            </label>
            <input
              type="date"
              value={filtros.fecha_inicio}
              onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha fin
            </label>
            <input
              type="date"
              value={filtros.fecha_fin}
              onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vigilante
            </label>
            <select
              value={filtros.vigilante_id}
              onChange={(e) => setFiltros({ ...filtros, vigilante_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Todos</option>
              {vigilantes.map((v: any) => (
                <option key={v.id} value={v.id}>{v.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estatus
            </label>
            <select
              value={filtros.estatus}
              onChange={(e) => setFiltros({ ...filtros, estatus: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="">Todos</option>
              <option value="COMPLETA">Completa</option>
              <option value="INCOMPLETA">Incompleta</option>
              <option value="INVALIDA">Inválida</option>
              <option value="NO_REALIZADA">No realizada</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Tabla de rondas */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : rondas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fecha/Hora</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vigilante</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ruta</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ventana</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Estatus</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rondas.map((ronda: any) => (
                  <tr key={ronda.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {ronda.inicio
                        ? format(new Date(ronda.inicio), "d MMM HH:mm", { locale: es })
                        : '-'
                      }
                    </td>
                    <td className="py-3 px-4 text-sm">{ronda.vigilante?.nombre}</td>
                    <td className="py-3 px-4 text-sm">{ronda.ruta?.nombre}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {format(new Date(ronda.ventana_inicio), "HH:mm", { locale: es })} -
                      {format(new Date(ronda.ventana_fin), "HH:mm", { locale: es })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={ronda.estatus} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link to={`/rondas/${ronda.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No se encontraron rondas con los filtros seleccionados</p>
          </div>
        )}
      </Card>
    </div>
  );
}

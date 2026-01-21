import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Calendar, TrendingUp } from 'lucide-react';
import Card from '../components/Card';
import { reportesApi, vigilantesApi, rutasApi } from '../lib/api';

type TipoReporte = 'diario' | 'vigilante' | 'ruta' | 'no-realizadas';

export default function Reportes() {
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('diario');
  const [filtros, setFiltros] = useState({
    fecha: format(new Date(), 'yyyy-MM-dd'),
    fecha_inicio: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    fecha_fin: format(new Date(), 'yyyy-MM-dd'),
    vigilante_id: '',
    ruta_id: ''
  });

  const { data: vigilantesData } = useQuery({
    queryKey: ['vigilantes'],
    queryFn: () => vigilantesApi.list()
  });

  const { data: rutasData } = useQuery({
    queryKey: ['rutas'],
    queryFn: () => rutasApi.list()
  });

  const { data: reporteData, isLoading } = useQuery({
    queryKey: ['reporte', tipoReporte, filtros],
    queryFn: () => {
      switch (tipoReporte) {
        case 'diario':
          return reportesApi.diario(filtros.fecha);
        case 'vigilante':
          if (!filtros.vigilante_id) return null;
          return reportesApi.porVigilante(filtros.vigilante_id, filtros.fecha_inicio, filtros.fecha_fin);
        case 'ruta':
          if (!filtros.ruta_id) return null;
          return reportesApi.porRuta(filtros.ruta_id, filtros.fecha_inicio, filtros.fecha_fin);
        case 'no-realizadas':
          return reportesApi.noRealizadas({
            fecha_inicio: filtros.fecha_inicio,
            fecha_fin: filtros.fecha_fin,
            vigilante_id: filtros.vigilante_id || undefined
          });
        default:
          return null;
      }
    },
    enabled: tipoReporte === 'diario' ||
             (tipoReporte === 'vigilante' && !!filtros.vigilante_id) ||
             (tipoReporte === 'ruta' && !!filtros.ruta_id) ||
             tipoReporte === 'no-realizadas'
  });

  const vigilantes = vigilantesData?.data || [];
  const rutas = rutasData?.data || [];

  const renderFiltros = () => {
    switch (tipoReporte) {
      case 'diario':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={filtros.fecha}
              onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
        );

      case 'vigilante':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigilante</label>
              <select
                value={filtros.vigilante_id}
                onChange={(e) => setFiltros({ ...filtros, vigilante_id: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-w-[200px]"
              >
                <option value="">Seleccionar...</option>
                {vigilantes.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.fecha_inicio}
                onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.fecha_fin}
                onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </>
        );

      case 'ruta':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ruta</label>
              <select
                value={filtros.ruta_id}
                onChange={(e) => setFiltros({ ...filtros, ruta_id: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-w-[200px]"
              >
                <option value="">Seleccionar...</option>
                {rutas.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.fecha_inicio}
                onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.fecha_fin}
                onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </>
        );

      case 'no-realizadas':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigilante (opcional)</label>
              <select
                value={filtros.vigilante_id}
                onChange={(e) => setFiltros({ ...filtros, vigilante_id: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none min-w-[200px]"
              >
                <option value="">Todos</option>
                {vigilantes.map((v: any) => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
              <input
                type="date"
                value={filtros.fecha_inicio}
                onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
              <input
                type="date"
                value={filtros.fecha_fin}
                onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </>
        );
    }
  };

  const renderResultados = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      );
    }

    if (!reporteData?.data) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Selecciona los filtros para generar el reporte</p>
        </div>
      );
    }

    const data = reporteData.data;

    switch (tipoReporte) {
      case 'diario':
        return (
          <div className="space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{data.resumen?.total_turnos || 0}</p>
                <p className="text-sm text-gray-500">Turnos</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{data.resumen?.total_rondas_completas || 0}</p>
                <p className="text-sm text-gray-500">Completas</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{data.resumen?.total_rondas_esperadas || 0}</p>
                <p className="text-sm text-gray-500">Esperadas</p>
              </div>
              <div className="bg-primary-50 p-4 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary-600">{data.resumen?.cumplimiento_general || 0}%</p>
                <p className="text-sm text-gray-500">Cumplimiento</p>
              </div>
            </div>

            {/* Tabla */}
            {data.turnos?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vigilante</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ruta</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Esperadas</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Completas</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.turnos.map((t: any, i: number) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm">{t.vigilante?.nombre}</td>
                        <td className="py-3 px-4 text-sm">{t.ruta?.nombre}</td>
                        <td className="py-3 px-4 text-sm text-center">{t.rondas_esperadas}</td>
                        <td className="py-3 px-4 text-sm text-center text-green-600">{t.rondas_completas}</td>
                        <td className="py-3 px-4 text-sm text-center font-medium">{t.cumplimiento}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'vigilante':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium">{data.vigilante?.nombre}</h4>
              <p className="text-sm text-gray-500">
                Período: {data.periodo?.fecha_inicio} - {data.periodo?.fecha_fin}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold">{data.resumen?.total_turnos}</p>
                <p className="text-xs text-gray-500">Turnos</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-600">{data.resumen?.total_rondas_completas}</p>
                <p className="text-xs text-gray-500">Completas</p>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{data.resumen?.total_rondas_incompletas}</p>
                <p className="text-xs text-gray-500">Incompletas</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold text-gray-600">{data.resumen?.total_rondas_no_realizadas}</p>
                <p className="text-xs text-gray-500">No realizadas</p>
              </div>
              <div className="text-center p-3 bg-primary-50 rounded-lg">
                <p className="text-xl font-bold text-primary-600">{data.resumen?.cumplimiento_general}%</p>
                <p className="text-xs text-gray-500">Cumplimiento</p>
              </div>
            </div>
          </div>
        );

      case 'ruta':
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium">{data.ruta?.nombre}</h4>
              <p className="text-sm text-gray-500">Frecuencia: cada {data.ruta?.frecuencia_min} minutos</p>
            </div>

            {data.estadisticas_por_estacion?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Estación</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Registros</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">A tiempo</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Retrasados</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Omitidos</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Prom. diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.estadisticas_por_estacion.map((est: any) => (
                      <tr key={est.estacion.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-medium">
                              {est.estacion.orden}
                            </span>
                            {est.estacion.nombre}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-center">{est.total_registros}</td>
                        <td className="py-3 px-4 text-sm text-center text-green-600">{est.a_tiempo}</td>
                        <td className="py-3 px-4 text-sm text-center text-yellow-600">{est.retrasados}</td>
                        <td className="py-3 px-4 text-sm text-center text-red-600">{est.omitidos}</td>
                        <td className="py-3 px-4 text-sm text-center">
                          {est.promedio_diferencia_seg > 0 ? '+' : ''}{est.promedio_diferencia_seg}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case 'no-realizadas':
        const rondas = Array.isArray(reporteData.data) ? reporteData.data : [];
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">Total: {rondas.length} rondas no realizadas</p>

            {rondas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fecha</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vigilante</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ruta</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ventana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rondas.map((r: any) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm">
                          {format(new Date(r.ventana_inicio), "d MMM yyyy", { locale: es })}
                        </td>
                        <td className="py-3 px-4 text-sm">{r.vigilante?.nombre}</td>
                        <td className="py-3 px-4 text-sm">{r.ruta?.nombre}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {format(new Date(r.ventana_inicio), "HH:mm")} -
                          {format(new Date(r.ventana_fin), "HH:mm")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No hay rondas no realizadas en este período</p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-gray-500">Genera reportes de cumplimiento</p>
      </div>

      {/* Tipo de reporte */}
      <Card>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'diario', label: 'Diario', icon: Calendar },
            { id: 'vigilante', label: 'Por Vigilante', icon: TrendingUp },
            { id: 'ruta', label: 'Por Ruta', icon: TrendingUp },
            { id: 'no-realizadas', label: 'No Realizadas', icon: FileText }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTipoReporte(id as TipoReporte)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                tipoReporte === id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Filtros */}
      <Card title="Filtros">
        <div className="flex flex-wrap gap-4 items-end">
          {renderFiltros()}
        </div>
      </Card>

      {/* Resultados */}
      <Card title="Resultados">
        {renderResultados()}
      </Card>
    </div>
  );
}

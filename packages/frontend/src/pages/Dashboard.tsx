import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import Card from '../components/Card';
import { reportesApi } from '../lib/api';

const COLORS = {
  COMPLETA: '#22c55e',
  INCOMPLETA: '#f59e0b',
  INVALIDA: '#ef4444',
  NO_REALIZADA: '#6b7280'
};

export default function Dashboard() {
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const mesActual = format(new Date(), 'yyyy-MM');

  const { data: reporteDiario, isLoading } = useQuery({
    queryKey: ['reporte-diario', hoy],
    queryFn: () => reportesApi.diario(hoy)
  });

  const { data: estadisticasData, isLoading: isLoadingEstadisticas } = useQuery({
    queryKey: ['estadisticas-mes', mesActual],
    queryFn: () => reportesApi.estadisticas({ mes: mesActual })
  });

  const resumen = reporteDiario?.data?.resumen;
  const turnos = reporteDiario?.data?.turnos || [];
  const estadisticas = estadisticasData?.data || [];

  const pieData = resumen ? [
    { name: 'Completas', value: turnos.reduce((acc: number, t: any) => acc + t.rondas_completas, 0), color: COLORS.COMPLETA },
    { name: 'Incompletas', value: turnos.reduce((acc: number, t: any) => acc + t.rondas_incompletas, 0), color: COLORS.INCOMPLETA },
    { name: 'Inválidas', value: turnos.reduce((acc: number, t: any) => acc + t.rondas_invalidas, 0), color: COLORS.INVALIDA },
    { name: 'No realizadas', value: turnos.reduce((acc: number, t: any) => acc + t.rondas_no_realizadas, 0), color: COLORS.NO_REALIZADA }
  ].filter(d => d.value > 0) : [];

  const barData = turnos.map((t: any) => ({
    nombre: t.vigilante?.nombre?.split(' ')[0] || 'N/A',
    cumplimiento: t.cumplimiento
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completas</p>
              <p className="text-2xl font-bold text-gray-900">
                {turnos.reduce((acc: number, t: any) => acc + t.rondas_completas, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Incompletas</p>
              <p className="text-2xl font-bold text-gray-900">
                {turnos.reduce((acc: number, t: any) => acc + t.rondas_incompletas, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inválidas</p>
              <p className="text-2xl font-bold text-gray-900">
                {turnos.reduce((acc: number, t: any) => acc + t.rondas_invalidas, 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <Clock className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">No realizadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {turnos.reduce((acc: number, t: any) => acc + t.rondas_no_realizadas, 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Distribución de Rondas">
          {pieData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm text-gray-600">
                      {entry.name}: {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No hay datos para mostrar
            </div>
          )}
        </Card>

        <Card title="Cumplimiento por Vigilante">
          {barData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <XAxis dataKey="nombre" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Cumplimiento']}
                  />
                  <Bar dataKey="cumplimiento" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No hay datos para mostrar
            </div>
          )}
        </Card>
      </div>

      {/* Cumplimiento general */}
      <Card title="Cumplimiento General del Día">
        <div className="flex items-center gap-6">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-gray-200"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${(resumen?.cumplimiento_general || 0) * 3.52} 352`}
                className="text-primary-600"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{resumen?.cumplimiento_general || 0}%</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <TrendingUp className="h-5 w-5" />
              <span>Rondas esperadas: {resumen?.total_rondas_esperadas || 0}</span>
            </div>
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span>Rondas completas: {resumen?.total_rondas_completas || 0}</span>
            </div>
            <p className="text-sm text-gray-500">
              Turnos activos hoy: {resumen?.total_turnos || 0}
            </p>
          </div>
        </div>
      </Card>

      {/* Lista de turnos del día */}
      <Card title="Turnos del Día">
        {turnos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vigilante</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ruta</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Esperadas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Completas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Incompletas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((turno: any) => (
                  <tr key={turno.turno_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{turno.vigilante?.nombre}</td>
                    <td className="py-3 px-4 text-sm">{turno.ruta?.nombre}</td>
                    <td className="py-3 px-4 text-sm text-center">{turno.rondas_esperadas}</td>
                    <td className="py-3 px-4 text-sm text-center text-green-600">{turno.rondas_completas}</td>
                    <td className="py-3 px-4 text-sm text-center text-yellow-600">{turno.rondas_incompletas}</td>
                    <td className="py-3 px-4 text-sm text-center">
                      <span className={`font-medium ${turno.cumplimiento >= 80 ? 'text-green-600' : turno.cumplimiento >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {turno.cumplimiento}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No hay turnos activos hoy</p>
        )}
      </Card>

      {/* Estadísticas del mes */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary-600" />
            <span>Estadísticas del Mes ({format(new Date(), 'MMMM yyyy', { locale: es })})</span>
          </div>
        }
      >
        {isLoadingEstadisticas ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : estadisticas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Vigilante</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Turno</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Días</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Rondas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">x Día</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Completas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Incompletas</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Rendimiento</th>
                </tr>
              </thead>
              <tbody>
                {estadisticas.map((est: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{est.vigilante}</td>
                    <td className="py-3 px-4 text-sm text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        est.turno === 'DIURNO'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {est.turno}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-center">{est.dias}</td>
                    <td className="py-3 px-4 text-sm text-center font-medium">{est.rondas_periodo}</td>
                    <td className="py-3 px-4 text-sm text-center text-gray-500">{est.rondas_por_dia}</td>
                    <td className="py-3 px-4 text-sm text-center text-green-600 font-medium">{est.rondas_completas}</td>
                    <td className="py-3 px-4 text-sm text-center text-yellow-600">{est.rondas_incompletas}</td>
                    <td className="py-3 px-4 text-sm text-center">
                      <span className={`font-bold ${
                        est.rendimiento >= 80 ? 'text-green-600' :
                        est.rendimiento >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {est.rendimiento}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No hay estadísticas disponibles para este mes</p>
        )}
      </Card>
    </div>
  );
}

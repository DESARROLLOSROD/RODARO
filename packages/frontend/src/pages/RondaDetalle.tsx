import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, MapPin, Clock, User, Route } from 'lucide-react';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import { rondasApi } from '../lib/api';

function formatDiferencia(segundos: number | null): string {
  if (segundos === null) return '-';

  const abs = Math.abs(segundos);
  const signo = segundos >= 0 ? '+' : '-';

  if (abs < 60) return `${signo}${abs}s`;

  const min = Math.floor(abs / 60);
  const seg = abs % 60;

  return `${signo}${min}m ${seg}s`;
}

export default function RondaDetalle() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['ronda', id],
    queryFn: () => rondasApi.get(id!),
    enabled: !!id
  });

  const ronda = data?.data;
  const detalles = ronda?.detalles || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !ronda) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error al cargar la ronda</p>
        <Link to="/rondas">
          <Button variant="secondary" className="mt-4">
            Volver
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/rondas">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalle de Ronda</h1>
          <p className="text-gray-500">
            {ronda.inicio
              ? format(new Date(ronda.inicio), "EEEE d 'de' MMMM, yyyy HH:mm", { locale: es })
              : 'Sin inicio registrado'
            }
          </p>
        </div>
      </div>

      {/* Información general */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vigilante</p>
              <p className="font-medium">{ronda.vigilante?.nombre}</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Route className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ruta</p>
              <p className="font-medium">{ronda.ruta?.nombre}</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ventana</p>
              <p className="font-medium">
                {format(new Date(ronda.ventana_inicio), "HH:mm")} -
                {format(new Date(ronda.ventana_fin), "HH:mm")}
              </p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-gray-500">Estatus</p>
              <StatusBadge status={ronda.estatus} className="mt-1" />
            </div>
          </div>
        </Card>
      </div>

      {/* Observaciones */}
      {ronda.observaciones && (
        <Card title="Observaciones">
          <p className="text-gray-600">{ronda.observaciones}</p>
        </Card>
      )}

      {/* Timeline de estaciones */}
      <Card title="Recorrido">
        {detalles.length > 0 ? (
          <div className="relative">
            {/* Línea vertical */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-6">
              {detalles.sort((a: any, b: any) => a.orden - b.orden).map((detalle: any, index: number) => {
                const anterior = index > 0 ? detalles[index - 1] : null;
                const intervalS = (anterior && anterior.fecha_hora && detalle.fecha_hora)
                  ? Math.round((new Date(detalle.fecha_hora).getTime() - new Date(anterior.fecha_hora).getTime()) / 1000)
                  : null;

                return (
                  <div key={detalle.id} className="relative pl-10">
                    <div
                      className={`absolute left-2 w-5 h-5 rounded-full border-2 ${detalle.estatus === 'A_TIEMPO'
                          ? 'bg-green-500 border-green-500'
                          : detalle.estatus === 'RETRASADO'
                            ? 'bg-yellow-500 border-yellow-500'
                            : 'bg-gray-300 border-gray-300'
                        }`}
                    />

                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <MapPin className={`h-5 w-5 ${detalle.estatus === 'OMITIDO' ? 'text-gray-400' : 'text-primary-600'
                            }`} />
                          <div>
                            <p className="font-medium text-gray-900">
                              {detalle.estacion?.nombre || `Estación ${detalle.orden}`}
                            </p>
                            <p className="text-sm text-gray-500">
                              Orden: {detalle.orden} | TAG: {detalle.estacion?.tag}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={detalle.estatus} />
                          {intervalS !== null && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              Intervalo: {formatDiferencia(intervalS).replace('+', '')}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Hora registro:</span>
                          <span className="ml-2 font-medium">
                            {detalle.fecha_hora
                              ? format(new Date(detalle.fecha_hora), "HH:mm:ss")
                              : '-'
                            }
                          </span>
                        </div>
                        <div>
                          <span className={`ml-2 font-medium ${detalle.diferencia_seg === null
                              ? 'text-gray-400'
                              : Math.abs(detalle.diferencia_seg) > (detalle.estacion?.tolerancia_seg || 300)
                                ? 'text-red-600'
                                : (detalle.diferencia_seg > 0 ? 'text-yellow-600' : 'text-green-600')
                            }`}>
                            {detalle.diferencia_seg !== null && detalle.diferencia_seg !== 0
                              ? formatDiferencia(detalle.diferencia_seg)
                              : (detalle.orden === 1 ? 'Inicio' : 'Ok')
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No hay estaciones registradas para esta ronda
          </p>
        )}
      </Card>

      {/* Tiempos */}
      <Card title="Tiempos">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Inicio ronda</p>
            <p className="text-lg font-medium">
              {ronda.inicio
                ? format(new Date(ronda.inicio), "HH:mm:ss")
                : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Fin ronda</p>
            <p className="text-lg font-medium">
              {ronda.fin
                ? format(new Date(ronda.fin), "HH:mm:ss")
                : '-'
              }
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duración total</p>
            <p className="text-lg font-medium">
              {ronda.inicio && ronda.fin
                ? formatDiferencia(
                  Math.round((new Date(ronda.fin).getTime() - new Date(ronda.inicio).getTime()) / 1000)
                ).replace('+', '')
                : '-'
              }
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

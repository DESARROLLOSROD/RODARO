import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Eye, FileUp, Loader2, X, CheckCircle2 } from 'lucide-react';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Button from '../components/Button';
import { rondasApi, vigilantesApi, eventosApi } from '../lib/api';

export default function Rondas() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    total: number;
    nuevos: number;
    duplicados: number;
    rondas: number;
    error?: string;
  } | null>(null);

  const [filtros, setFiltros] = useState({
    estatus: '',
    vigilante_id: '',
    fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
    fecha_fin: format(new Date(), 'yyyy-MM-dd')
  });

  const rondasApiQuery = useQuery({
    queryKey: ['rondas', filtros],
    queryFn: () => rondasApi.list({
      ...filtros,
      limit: '50'
    })
  });

  const { data: rondasData, isLoading } = rondasApiQuery;

  const { data: vigilantesData } = useQuery({
    queryKey: ['vigilantes'],
    queryFn: () => vigilantesApi.list(true)
  });

  const rondas = rondasData?.data || [];
  const vigilantes = vigilantesData?.data || [];

  const parseReaderFile = (content: string) => {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const eventos: any[] = [];

    for (const linea of lines) {
      if (linea.startsWith('H ')) continue; // Ignorar header

      // Formato Lector: "20260114210613 31 00001437815B"
      const matchLector = linea.match(/^(\d{14})\s+(\d+)\s+([0-9A-Fa-f]{10,16})$/);
      if (matchLector) {
        const f = matchLector[1];
        const date = new Date(
          parseInt(f.substring(0, 4)),
          parseInt(f.substring(4, 6)) - 1,
          parseInt(f.substring(6, 8)),
          parseInt(f.substring(8, 10)),
          parseInt(f.substring(10, 12)),
          parseInt(f.substring(12, 14))
        );
        eventos.push({
          tag: matchLector[3].toUpperCase(),
          fecha_hora: date.toISOString(),
          datos_crudos: linea
        });
        continue;
      }

      // Formato CSV Simple: "TAG,YYYY-MM-DD HH:MM:SS"
      const partes = linea.split(',');
      if (partes.length >= 2) {
        const tag = partes[0].trim().toUpperCase();
        if (/^[0-9A-Fa-f]{8,16}$/.test(tag)) {
          const date = new Date(partes[1].trim());
          if (!isNaN(date.getTime())) {
            eventos.push({
              tag,
              fecha_hora: date.toISOString(),
              datos_crudos: linea
            });
          }
        }
      }
    }
    return eventos;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const eventos = parseReaderFile(content);

        if (eventos.length === 0) {
          throw new Error('No se detectaron eventos válidos en el archivo');
        }

        const res = await eventosApi.descarga({
          lector_id: `WEB_UPLOAD_${file.name}`,
          eventos,
          timestamp_descarga: new Date().toISOString()
        });

        if (res.success) {
          setUploadResult({
            success: true,
            total: eventos.length,
            nuevos: res.procesados,
            duplicados: res.duplicados,
            rondas: res.rondas_afectadas
          });
          rondasApiQuery.refetch();
        } else {
          throw new Error('Error al procesar la descarga');
        }
      } catch (error: any) {
        setUploadResult({
          success: false,
          total: 0,
          nuevos: 0,
          duplicados: 0,
          rondas: 0,
          error: error.message
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
            <FileUp className="h-4 w-4 mr-2" />
            Cargar Archivo Lector
          </Button>
        </div>
      </div>

      {/* Modal de Carga */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Cargar Archivo del Lector</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadResult(null); }}>
                <X className="h-5 w-5 text-gray-500 hover:text-gray-700" />
              </button>
            </div>

            <div className="space-y-4">
              {!uploadResult ? (
                <>
                  <p className="text-sm text-gray-500">
                    Seleccione el archivo de texto (.txt) descargado del lector de rondines.
                  </p>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                    {isUploading ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin mb-2" />
                        <span className="text-sm font-medium">Procesando archivo...</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer">
                        <FileUp className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                        <span className="text-sm font-medium text-primary-600 hover:text-primary-700">
                          Haga clic para subir archivo
                        </span>
                        <input
                          type="file"
                          accept=".txt,.csv"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4">
                  {uploadResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center text-green-600 gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-bold">Carga completada</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-white p-2 rounded border border-gray-100">
                          <span className="text-gray-500 block text-xs">Eventos</span>
                          <span className="font-bold">{uploadResult.total}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-100">
                          <span className="text-gray-500 block text-xs">Nuevos</span>
                          <span className="font-bold text-green-600">{uploadResult.nuevos}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-100">
                          <span className="text-gray-500 block text-xs">Rondas act.</span>
                          <span className="font-bold">{uploadResult.rondas}</span>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-100">
                          <span className="text-gray-500 block text-xs">Duplicados</span>
                          <span className="font-bold text-gray-400">{uploadResult.duplicados}</span>
                        </div>
                      </div>
                      <Button className="w-full mt-4" onClick={() => setShowUploadModal(false)}>
                        Cerrar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
                        {uploadResult.error || 'Error al procesar el archivo'}
                      </div>
                      <Button onClick={() => setUploadResult(null)}>
                        Reintentar
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

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

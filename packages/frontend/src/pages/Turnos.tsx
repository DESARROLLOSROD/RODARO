import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addHours, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, parseISO, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Calendar, Clock, Upload, Download, FileUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../components/Card';
import Button from '../components/Button';
import { turnosApi, vigilantesApi, rutasApi, festivosApi } from '../lib/api';
import { Trash2 } from 'lucide-react';

interface TurnoForm {
  vigilante_id: string;
  ruta_id: string;
  inicio: string;
  fin: string;
}

export default function Turnos() {
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showFestivos, setShowFestivos] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [bulkData, setBulkData] = useState<string>('');
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkError, setBulkError] = useState<string>('');
  const [festivoFecha, setFestivoFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [festivoDesc, setFestivoDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: festivosData } = useQuery({
    queryKey: ['festivos', bulkMonth.split('-')[0]],
    queryFn: () => festivosApi.list(bulkMonth.split('-')[0])
  });

  const festivos = festivosData?.data || [];

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

  const createFestivoMutation = useMutation({
    mutationFn: festivosApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['festivos'] });
      setFestivoDesc('');
    }
  });

  const deleteFestivoMutation = useMutation({
    mutationFn: festivosApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['festivos'] });
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

  // Crear múltiples turnos
  const bulkCreateMutation = useMutation({
    mutationFn: async (turnos: any[]) => {
      const results = [];
      for (const turno of turnos) {
        const result = await turnosApi.create(turno);
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turnos'] });
      setShowBulkUpload(false);
      setBulkData('');
      setBulkPreview([]);
      setBulkError('');
    }
  });

  // Parsear CSV/texto del rol
  const parseBulkData = (text: string) => {
    setBulkError('');
    const lines = text.trim().split('\n').filter(l => l.trim());

    if (lines.length === 0) {
      setBulkPreview([]);
      return;
    }

    const preview: any[] = [];
    const errors: string[] = [];

    // Formato esperado: NOMBRE_VIGILANTE,DIA (1-31)
    // Ejemplo:
    // Juan Perez,1
    // Juan Perez,4
    // Maria Lopez,2
    // Maria Lopez,5

    // Calcular días del mes seleccionado
    const [year, month] = bulkMonth.split('-').map(Number);
    const lastDayOfMonth = endOfMonth(new Date(year, month - 1)).getDate();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      const parts = line.split(/[,;\t]/).map(p => p.trim()).filter(p => p);

      if (parts.length < 2) {
        // Ignorar líneas que solo tienen nombre sin día
        continue;
      }

      const [nombreVigilante, diaStr] = parts;

      // Ignorar si el nombre o día están vacíos
      if (!nombreVigilante || !diaStr) continue;

      const dia = parseInt(diaStr);

      if (isNaN(dia) || dia < 1 || dia > lastDayOfMonth) {
        errors.push(`Línea ${i + 1}: Día inválido "${diaStr}" (el mes tiene ${lastDayOfMonth} días)`);
        continue;
      }

      // Buscar vigilante por nombre
      const vigilante = vigilantes.find((v: any) =>
        v.nombre.toLowerCase().includes(nombreVigilante.toLowerCase()) ||
        nombreVigilante.toLowerCase().includes(v.nombre.toLowerCase())
      );

      if (!vigilante) {
        errors.push(`Línea ${i + 1}: Vigilante "${nombreVigilante}" no encontrado`);
        continue;
      }

      // Usar la primera ruta activa por defecto
      const ruta = rutas[0];
      if (!ruta) {
        errors.push('No hay rutas activas configuradas');
        break;
      }

      // Calcular fecha del turno
      const date = new Date(year, month - 1, dia);
      const isFestivo = festivos.some((f: any) => isSameDay(parseISO(f.fecha), date));
      const weekendDay = isWeekend(date);

      // Reglas:
      // Mon-Fri: Solo noche (19:00 - 07:00)
      // Sat-Sun-Festivo: Dia (07:00 - 19:00) y Noche (19:00 - 07:00)

      if (weekendDay || isFestivo) {
        // Generar turno dia
        const inicioDia = new Date(year, month - 1, dia, 7, 0, 0);
        preview.push({
          vigilante_id: vigilante.id,
          vigilante_nombre: vigilante.nombre,
          ruta_id: ruta.id,
          ruta_nombre: ruta.nombre,
          dia,
          tipo: 'DIURNO',
          inicio: inicioDia.toISOString(),
          fin: addHours(inicioDia, 12).toISOString()
        });

        // El turno noche lo generamos siempre (ver abajo)
      }

      // Turno noche (siempre se genera)
      const inicioNoche = new Date(year, month - 1, dia, 19, 0, 0);
      preview.push({
        vigilante_id: vigilante.id,
        vigilante_nombre: vigilante.nombre,
        ruta_id: ruta.id,
        ruta_nombre: ruta.nombre,
        dia,
        tipo: 'NOCTURNO',
        inicio: inicioNoche.toISOString(),
        fin: addHours(inicioNoche, 12).toISOString()
      });
    }

    if (errors.length > 0) {
      setBulkError(errors.join('\n'));
    }

    // Ordenar por día y vigilante
    preview.sort((a, b) => a.dia - b.dia || a.vigilante_nombre.localeCompare(b.vigilante_nombre));
    setBulkPreview(preview);
  };

  const parseExcelGridData = (workbook: XLSX.WorkBook) => {
    setBulkError('');
    const sheetName = workbook.SheetNames.find(n => n.includes('VIGILANCIA') || n.includes('ROL')) || workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length === 0) {
      setBulkError('El archivo Excel está vacío');
      return;
    }

    const preview: any[] = [];

    // Buscar el año y mes
    const [year, month] = bulkMonth.split('-').map(Number);
    const lastDayOfMonth = endOfMonth(new Date(year, month - 1)).getDate();

    // Buscar la fila de encabezado de días (generalmente tiene números 1, 2, 3...)
    let dayRowIndex = -1;
    let daysColOffset = -1;

    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i];
      if (!row) continue;
      const firstDayIdx = row.findIndex(cell => cell === 1 || cell === '1');
      if (firstDayIdx !== -1 && row[firstDayIdx + 1] === 2) {
        dayRowIndex = i;
        daysColOffset = firstDayIdx;
        break;
      }
    }

    if (dayRowIndex === -1) {
      setBulkError('No se encontró la fila de días (1, 2, 3...). Asegúrese de usar el formato correcto.');
      return;
    }

    // Usar la primera ruta activa por defecto
    const ruta = rutas[0];
    if (!ruta) {
      setBulkError('No hay rutas activas configuradas');
      return;
    }

    // Procesar cada fila buscando nombres de vigilantes
    for (let i = dayRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      // El nombre suele estar antes de los días (Columna C/D)
      let nombreVigilante = "";
      for (let j = Math.max(0, daysColOffset - 3); j < daysColOffset; j++) {
        if (row[j] && typeof row[j] === 'string' && row[j].trim().length > 3) {
          nombreVigilante = row[j].trim();
          break;
        }
      }

      if (!nombreVigilante) continue;

      // Buscar vigilante en la DB
      const vigilante = vigilantes.find((v: any) =>
        v.nombre.toLowerCase().includes(nombreVigilante.toLowerCase()) ||
        nombreVigilante.toLowerCase().includes(v.nombre.toLowerCase())
      );

      if (!vigilante) continue;

      // Procesar cada día disponible en la fila
      for (let d = 1; d <= lastDayOfMonth; d++) {
        const colIdx = daysColOffset + d - 1;
        const cellValue = row[colIdx];

        if (!cellValue) continue;

        const code = String(cellValue).trim().toUpperCase();
        if (code === 'N' || code === 'T' || code === 'V' || code === 'F') {
          // Asumimos N = Noche (19:00), T/V/F = Día (07:00) para simplificar si no se especifica
          const hour = code === 'N' ? 19 : 7;
          const inicio = new Date(year, month - 1, d, hour, 0, 0);

          preview.push({
            vigilante_id: vigilante.id,
            vigilante_nombre: vigilante.nombre,
            ruta_id: ruta.id,
            ruta_nombre: ruta.nombre,
            dia: d,
            tipo: code === 'N' ? 'NOCTURNO' : 'DIURNO',
            inicio: inicio.toISOString(),
            fin: addHours(inicio, 12).toISOString()
          });
        }
      }
    }

    if (preview.length === 0) {
      setBulkError('No se detectaron turnos (N o T) en el archivo para el mes seleccionado.');
    }

    preview.sort((a, b) => a.dia - b.dia || a.vigilante_nombre.localeCompare(b.vigilante_nombre));
    setBulkPreview(preview);
  };

  // Generar plantilla CSV
  const downloadTemplate = () => {
    const [year, month] = bulkMonth.split('-').map(Number);
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(start);
    const days = eachDayOfInterval({ start, end });
    const lastDay = days.length;

    let csv = '# Rol de Turnos - ' + format(start, 'MMMM yyyy', { locale: es }) + '\n';
    csv += `# Este mes tiene ${lastDay} días\n`;
    csv += '# Formato: NOMBRE_VIGILANTE,DIA\n';
    csv += '# Patrón 24x48: trabaja 1 día, descansa 2\n';
    csv += '# Borre estos comentarios y reemplace con sus datos\n\n';

    if (vigilantes.length > 0) {
      // Generar con vigilantes existentes
      vigilantes.forEach((v: any, index: number) => {
        const startDay = (index % 3) + 1;
        for (let d = startDay; d <= lastDay; d += 3) {
          csv += `${v.nombre},${d}\n`;
        }
      });
    } else {
      // Generar ejemplo si no hay vigilantes
      csv += '# No hay vigilantes registrados. Registre vigilantes primero.\n';
      csv += '# Ejemplo de formato:\n';
      for (let d = 1; d <= lastDay; d += 3) {
        csv += `# Juan Perez,${d}\n`;
      }
      for (let d = 2; d <= lastDay; d += 3) {
        csv += `# Maria Lopez,${d}\n`;
      }
      for (let d = 3; d <= lastDay; d += 3) {
        csv += `# Carlos Garcia,${d}\n`;
      }
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `plantilla_rol_${bulkMonth}.csv`;
    link.click();
  };

  // Manejar archivo subido
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (file.name.endsWith('.xlsx')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        parseExcelGridData(workbook);
        setBulkData(`Archivo Excel cargado: ${file.name}`);
      } else {
        const text = data as string;
        setBulkData(text);
        parseBulkData(text);
      }
    };
    if (file.name.endsWith('.xlsx')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Guardar turnos masivos
  const handleBulkSubmit = () => {
    if (bulkPreview.length === 0) return;

    const turnos = bulkPreview.map(t => ({
      vigilante_id: t.vigilante_id,
      ruta_id: t.ruta_id,
      inicio: t.inicio,
      fin: t.fin
    }));

    bulkCreateMutation.mutate(turnos);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turnos</h1>
          <p className="text-gray-500">Gestión de turnos 24x48</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowFestivos(!showFestivos)}>
            <Calendar className="h-4 w-4 mr-2" />
            {showFestivos ? 'Cerrar Festivos' : 'Gestionar Festivos'}
          </Button>
          <Button variant="secondary" onClick={() => setShowBulkUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Cargar Rol Mensual
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Turno
          </Button>
        </div>
      </div>

      {/* Gestión de Festivos */}
      {showFestivos && (
        <Card title="Días Festivos (Horario de Fin de Semana)">
          <div className="space-y-4">
            <form
              className="flex gap-4 items-end"
              onSubmit={(e) => {
                e.preventDefault();
                createFestivoMutation.mutate({ fecha: festivoFecha, descripcion: festivoDesc });
              }}
            >
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <input
                  type="date"
                  value={festivoFecha}
                  onChange={(e) => setFestivoFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                  required
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  value={festivoDesc}
                  onChange={(e) => setFestivoDesc(e.target.value)}
                  placeholder="Ej: Navidad, Año Nuevo..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                />
              </div>
              <Button type="submit" isLoading={createFestivoMutation.isPending}>
                Agregar
              </Button>
            </form>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Festivos Registrados</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {festivos.map((f: any) => (
                  <div key={f.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-sm">
                      <span className="font-medium">{format(parseISO(f.fecha), 'dd MMM yyyy', { locale: es })}</span>
                      <p className="text-gray-500 text-xs">{f.descripcion || 'Sin descripción'}</p>
                    </div>
                    <button
                      onClick={() => deleteFestivoMutation.mutate(f.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                      title="Eliminar festivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {festivos.length === 0 && (
                <p className="text-center py-4 text-gray-500 text-sm">No hay festivos registrados para este año</p>
              )}
            </div>
          </div>
        </Card>
      )
      }

      {/* Formulario */}
      {
        showForm && (
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
        )
      }

      {/* Carga masiva de rol mensual */}
      {
        showBulkUpload && (
          <Card title="Cargar Rol Mensual">
            <div className="space-y-4">
              {/* Selector de mes y botón de plantilla */}
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mes del rol
                  </label>
                  <input
                    type="month"
                    value={bulkMonth}
                    onChange={(e) => setBulkMonth(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>

              {/* Subir archivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Archivo CSV del rol
                </label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    Seleccionar Archivo (Excel o CSV)
                  </Button>
                </div>
              </div>

              {/* Área de texto para pegar datos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  O pegue los datos aquí (NOMBRE,DIA)
                </label>
                <textarea
                  value={bulkData}
                  onChange={(e) => {
                    setBulkData(e.target.value);
                    parseBulkData(e.target.value);
                  }}
                  placeholder={`Juan Perez,1\nJuan Perez,4\nMaria Lopez,2\nMaria Lopez,5`}
                  className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono text-sm"
                />
              </div>

              {/* Errores */}
              {bulkError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm whitespace-pre-wrap">
                  {bulkError}
                </div>
              )}

              {/* Preview de turnos */}
              {bulkPreview.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Vista previa ({bulkPreview.length} turnos)
                  </h4>
                  <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-500">Día</th>
                          <th className="text-left py-2 px-3 text-gray-500">Vigilante</th>
                          <th className="text-left py-2 px-3 text-gray-500">Ruta</th>
                          <th className="text-left py-2 px-3 text-gray-500">Inicio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkPreview.map((t, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-2 px-3 font-medium">{t.dia}</td>
                            <td className="py-2 px-3">{t.vigilante_nombre}</td>
                            <td className="py-2 px-3">{t.ruta_nombre}</td>
                            <td className="py-2 px-3 text-gray-500">
                              {format(new Date(t.inicio), "d MMM HH:mm", { locale: es })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <Button
                  onClick={handleBulkSubmit}
                  disabled={bulkPreview.length === 0 || !!bulkError}
                  isLoading={bulkCreateMutation.isPending}
                >
                  Guardar {bulkPreview.length} Turnos
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowBulkUpload(false);
                    setBulkData('');
                    setBulkPreview([]);
                    setBulkError('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </Card>
        )
      }

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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${esActivo
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
    </div >
  );
}

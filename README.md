# Sistema de Rondines Integrado

Sistema moderno para gestión de rondines de vigilancia, reemplazando el software legacy de descarga.

## Arquitectura

```
[Lector COM] → [Agente Local Node.js] → [Backend API Railway] → [Supabase DB] → [React Web]
```

## Estructura del Proyecto

```
RODARO/
├── packages/
│   ├── shared/          # Tipos y utilidades compartidas
│   ├── backend/         # API REST (Railway)
│   ├── frontend/        # Aplicación web (React + Vite)
│   └── agent/           # Agente local de descarga (Windows)
├── supabase/
│   └── schema.sql       # Schema de base de datos
└── package.json         # Configuración del monorepo
```

## Requisitos

- Node.js 18+
- npm o yarn
- Cuenta en Supabase
- Cuenta en Railway (para deploy del backend)

## Instalación

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd RODARO
npm install
```

### 2. Configurar Supabase

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar el schema SQL en `supabase/schema.sql`
3. Copiar las credenciales del proyecto

### 3. Configurar Backend

```bash
cd packages/backend
cp .env.example .env
# Editar .env con las credenciales de Supabase
```

Variables de entorno necesarias:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENT_API_TOKEN` (generar token seguro para el agente)

### 4. Configurar Frontend

```bash
cd packages/frontend
cp .env.example .env.local
# Editar .env.local con las credenciales
```

Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

### 5. Configurar Agente Local

```bash
cd packages/agent
cp config.example.json config.json
# Editar config.json con la configuración del lector
```

## Desarrollo

### Ejecutar todo en desarrollo

```bash
# Desde la raíz del proyecto
npm run dev:backend   # Terminal 1
npm run dev:frontend  # Terminal 2
npm run dev:agent     # Terminal 3 (en Windows con lector)
```

### URLs de desarrollo

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## Despliegue

### Backend en Railway

1. Conectar repositorio a Railway
2. Configurar variables de entorno
3. Deploy automático

### Frontend

```bash
cd packages/frontend
npm run build
# Subir dist/ a Vercel, Netlify o servidor estático
```

### Agente Local

```bash
cd packages/agent
npm run build
# Genera rondines-agent.exe para Windows
```

## Reglas de Negocio

### Estados de Ronda

| Estado | Descripción |
|--------|-------------|
| COMPLETA | Secuencia E1→E2→...→En→E1 completa y a tiempo |
| INCOMPLETA | Falta estación o hay retardos fuera de tolerancia |
| INVALIDA | No inicia o no termina en Estación 1 |
| NO_REALIZADA | No existe inicio (E1) en la ventana esperada |

### Turnos 24x48

Los vigilantes trabajan turnos de 24 horas con 48 horas de descanso. Las rondas se esperan cada 2 o 3 horas según la frecuencia configurada en la ruta.

## Operación y Carga de Datos

El sistema permite la gestión automatizada y manual de la información.

### 1. Carga de Rol Mensual (Turnos)
Para que el sistema sepa cuándo esperar las rondas, es necesario cargar el rol de vigilancia:
1. Ir a la pestaña **Turnos**.
2. Clic en **Cargar Rol Mensual**.
3. Seleccionar el mes y subir el archivo Excel (.xlsx) con la cuadrícula de turnos.
4. El sistema identificará automáticamente a los vigilantes y los códigos de turno (N, T, DIA, NOCHE).
5. Revisar la vista previa y **Guardar**.

### 2. Carga de Archivos del Lector (Rondas)
Si el agente automático no está disponible, se pueden subir las descargas manualmente:
1. Ir a la pestaña **Rondas**.
2. Clic en **Cargar Archivo Lector**.
3. Seleccionar el archivo de texto (.txt) descargado del software del bastón.
    *   Formato soportado: `YYYYMMDDHHmmss 31 TAG`
4. El sistema procesará los eventos, ignorará duplicados y actualizará las rondas en tiempo real.

## API Endpoints

### Vigilantes
- `GET /api/vigilantes` - Listar vigilantes
- `POST /api/vigilantes` - Crear vigilante
- `PUT /api/vigilantes/:id` - Actualizar vigilante

### Rutas
- `GET /api/rutas` - Listar rutas con estaciones
- `POST /api/rutas` - Crear ruta con estaciones

### Turnos
- `GET /api/turnos` - Listar turnos
- `POST /api/turnos` - Crear turno
- `GET /api/turnos/:id/resumen` - Resumen del turno

### Rondas
- `GET /api/rondas` - Listar rondas
- `GET /api/rondas/:id` - Detalle de ronda

### Eventos (Agente)
- `POST /api/eventos/descarga` - Recibir descarga del lector

### Reportes
- `GET /api/reportes/diario?fecha=YYYY-MM-DD`
- `GET /api/reportes/vigilante/:id?fecha_inicio=&fecha_fin=`
- `GET /api/reportes/no-realizadas?fecha_inicio=&fecha_fin=`

## Configuración del Lector

El agente local soporta diferentes formatos de datos. Modificar `packages/agent/src/services/parser.ts` según el protocolo del lector.

Formatos soportados:
- CSV: `TAG,YYYY-MM-DD HH:MM:SS`
- Timestamp: `TAG UNIX_TIMESTAMP`
- Hexadecimal puro

## Soporte

Para preguntas o problemas, contactar al equipo de desarrollo.

---

Desarrollado por Desarrollos ROD

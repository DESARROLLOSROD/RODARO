import * as fs from 'fs';
import * as path from 'path';

export interface Config {
  api: {
    url: string;
    token: string;
  };
  lector: {
    puerto: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: 'none' | 'even' | 'odd' | 'mark' | 'space';
  };
  intervalo: {
    descargaSegundos: number;
    reintentoSegundos: number;
  };
  log: {
    nivel: string;
    archivo: string;
  };
}

const defaultConfig: Config = {
  api: {
    url: 'http://localhost:3001/api',
    token: ''
  },
  lector: {
    puerto: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none'
  },
  intervalo: {
    descargaSegundos: 30,
    reintentoSegundos: 5
  },
  log: {
    nivel: 'info',
    archivo: 'logs/agent.log'
  }
};

export function loadConfig(): Config {
  const configPaths = [
    path.join(process.cwd(), 'config.json'),
    path.join(__dirname, '..', '..', 'config.json'),
    path.join(__dirname, '..', 'config.json')
  ];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        console.log(`Configuración cargada desde: ${configPath}`);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.error(`Error leyendo configuración de ${configPath}:`, error);
      }
    }
  }

  // Verificar variables de entorno
  const envConfig: Partial<Config> = {};

  if (process.env.API_URL) {
    envConfig.api = {
      ...defaultConfig.api,
      url: process.env.API_URL
    };
  }

  if (process.env.API_TOKEN) {
    envConfig.api = {
      ...defaultConfig.api,
      ...envConfig.api,
      token: process.env.API_TOKEN
    };
  }

  if (process.env.LECTOR_PUERTO) {
    envConfig.lector = {
      ...defaultConfig.lector,
      puerto: process.env.LECTOR_PUERTO
    };
  }

  if (Object.keys(envConfig).length > 0) {
    console.log('Configuración cargada desde variables de entorno');
    return { ...defaultConfig, ...envConfig };
  }

  console.warn('No se encontró archivo de configuración. Usando valores por defecto.');
  console.warn('Crea un archivo config.json basándote en config.example.json');

  return defaultConfig;
}

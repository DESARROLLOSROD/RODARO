import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface EventoCrudo {
  tag: string;
  fecha_hora: string;
  datos_crudos?: string;
}

interface DescargaPayload {
  lector_id: string;
  eventos: EventoCrudo[];
  timestamp_descarga: string;
}

interface DescargaResponse {
  success: boolean;
  message?: string;
  procesados?: number;
  duplicados?: number;
  rondas_afectadas?: number;
}

export class ApiService {
  private client: AxiosInstance;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.token = token;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Token': token
      }
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Error en request:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(`API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
          logger.error(`API Error: ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data?.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  async enviarDescarga(payload: DescargaPayload): Promise<DescargaResponse> {
    try {
      const response = await this.client.post('/eventos/descarga', payload);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.error || 'Error desconocido'
        };
      }
      return {
        success: false,
        message: error.message || 'Error de conexión'
      };
    }
  }
}

/**
 * Configuración de modelos disponibles
 */

import { ModelConfig } from '@/types/ecg'

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'default',
    nombre: 'CNN1D-LSTM ECG v1',
    endpoint: process.env.SAGEMAKER_ENDPOINT_URL || 
      'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/cnn1d-lstm-ecg-v1-serverless/invocations',
    descripcion: 'Modelo CNN1D + LSTM para detección de anomalías en ECG',
    metadata: {
      arquitectura: 'CNN1D + LSTM',
      input_shape: [1, 2000, 3],
      frecuencia: '200 Hz',
      duracion: '10 segundos',
    },
  },
  // TODO: Agregar más modelos aquí cuando estén disponibles
]

export function getModelById(id: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === id)
}

export function getDefaultModel(): ModelConfig {
  return AVAILABLE_MODELS[0]
}


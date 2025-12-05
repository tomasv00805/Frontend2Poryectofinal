/**
 * Tipos TypeScript para el procesamiento de ECG
 */

// Formato de entrada: ECG crudo con 3 derivaciones
export interface RawECGData {
  tiempo_s: number[]
  II: number[]
  V1: number[]
  V5: number[]
  // Opcionales (pueden venir en el CSV)
  label?: number[]
  is_anomalo?: boolean[]
}

// Formato estándar interno: matriz [muestras, 3 canales]
export type ECGSignal = number[][] // [T, 3] donde T es el número de muestras

// Formato para el modelo: [batch, seq_len, n_channels] = [1, 2000, 3]
export type ModelInput = number[][][] // [[[2000 muestras, 3 canales]]]

// Estados del pipeline de procesamiento
export interface QualityCheckResult {
  status: 'OK' | 'RECHAZADA'
  mensaje: string
  razon_rechazo?: string
  duracion_segundos?: number
  fs_original?: number
}

export interface FilterResult {
  status: 'OK' | 'ERROR'
  mensaje: string
  filtros_aplicados: string[]
}

export interface NormalizationResult {
  status: 'OK' | 'ERROR'
  mensaje: string
  metodo: string
}

export interface ResamplingResult {
  status: 'OK' | 'ERROR'
  mensaje: string
  fs_final: number
  muestras_originales: number
  muestras_finales: number
}

export interface ProcessingStates {
  calidad: QualityCheckResult
  filtrado: FilterResult
  normalizacion: NormalizationResult
  resampling: ResamplingResult
}

// Respuesta del modelo SageMaker
export interface SageMakerResponse {
  prediction?: number
  probability?: number
  // Puede variar según el modelo
  [key: string]: any
}

// Respuesta completa de la API
export interface ProcessingResponse {
  signal_original: ECGSignal
  signal_filtrada: ECGSignal | null
  signal_normalizada: ECGSignal | null
  signal_resampleada: ECGSignal | null
  tensor_final?: {
    shape: number[]
    muestra_preview: number[][][] // Primeras muestras del tensor para visualización
  }
  estados: ProcessingStates
  prediccion: {
    clase: 'anomalo' | 'normal'
    score: number
  } | null
  modelo: {
    nombre: string
    endpoint: string
    metadata?: Record<string, any>
  }
  etiqueta_real?: {
    label_real?: number // 0 = normal, 1 = anómalo
    is_anomalo_real?: boolean
  }
}

// Configuración de modelo
export interface ModelConfig {
  id: string
  nombre: string
  endpoint: string
  descripcion: string
  metadata?: Record<string, any>
}


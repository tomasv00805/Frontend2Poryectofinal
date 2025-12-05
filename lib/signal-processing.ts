/**
 * Utilidades para procesamiento de señal ECG
 * Todas las funciones aquí son para uso en el servidor (API routes)
 */

import { ECGSignal, QualityCheckResult, FilterResult, NormalizationResult, ResamplingResult } from '@/types/ecg'

/**
 * Etapa 1: Chequeo de calidad de la señal
 */
export function checkQuality(
  signal: ECGSignal,
  fs: number,
  minDurationSeconds: number = 5,
  minStdDev: number = 0.01,
  maxNaNProportion: number = 0.1,
  maxFlatProportion: number = 0.5
): QualityCheckResult {
  const numSamples = signal.length
  const numChannels = signal[0]?.length || 0

  // Validar estructura básica
  if (numSamples === 0) {
    return {
      status: 'RECHAZADA',
      mensaje: 'Señal vacía',
      razon_rechazo: 'La señal no contiene muestras',
    }
  }

  if (numChannels !== 3) {
    return {
      status: 'RECHAZADA',
      mensaje: `Número de canales incorrecto: ${numChannels} (se esperan 3)`,
      razon_rechazo: 'Formato de señal inválido',
    }
  }

  // Calcular duración
  const durationSeconds = numSamples / fs
  if (durationSeconds < minDurationSeconds) {
    return {
      status: 'RECHAZADA',
      mensaje: `Duración insuficiente: ${durationSeconds.toFixed(2)}s (mínimo: ${minDurationSeconds}s)`,
      razon_rechazo: 'Duración mínima no alcanzada',
      duracion_segundos: durationSeconds,
      fs_original: fs,
    }
  }

  // Verificar cada canal
  for (let channel = 0; channel < numChannels; channel++) {
    const channelValues = signal.map(sample => sample[channel]).filter(v => !isNaN(v) && isFinite(v))
    
    if (channelValues.length === 0) {
      return {
        status: 'RECHAZADA',
        mensaje: `Canal ${channel} completamente inválido`,
        razon_rechazo: 'Canal sin valores válidos',
      }
    }

    // Proporción de NaN
    const nanCount = signal.filter(sample => isNaN(sample[channel]) || !isFinite(sample[channel])).length
    const nanProportion = nanCount / numSamples
    if (nanProportion > maxNaNProportion) {
      return {
        status: 'RECHAZADA',
        mensaje: `Canal ${channel} tiene demasiados valores inválidos: ${(nanProportion * 100).toFixed(1)}%`,
        razon_rechazo: 'Proporción de NaN excedida',
      }
    }

    // Desviación estándar
    const mean = channelValues.reduce((a, b) => a + b, 0) / channelValues.length
    const variance = channelValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channelValues.length
    const stdDev = Math.sqrt(variance)
    
    if (stdDev < minStdDev) {
      return {
        status: 'RECHAZADA',
        mensaje: `Canal ${channel} tiene desviación estándar muy baja: ${stdDev.toFixed(6)} (mínimo: ${minStdDev})`,
        razon_rechazo: 'Señal demasiado plana (posible artefacto)',
      }
    }

    // Detectar valores planos/constantes
    const uniqueValues = new Set(channelValues.map(v => Math.round(v * 1000) / 1000)) // Redondear a 3 decimales
    const flatProportion = 1 - (uniqueValues.size / channelValues.length)
    if (flatProportion > maxFlatProportion) {
      return {
        status: 'RECHAZADA',
        mensaje: `Canal ${channel} tiene demasiados valores constantes: ${(flatProportion * 100).toFixed(1)}%`,
        razon_rechazo: 'Señal demasiado constante',
      }
    }

    // Detección de saturación (valores que están en el máximo o mínimo del rango)
    const maxVal = Math.max(...channelValues)
    const minVal = Math.min(...channelValues)
    const range = maxVal - minVal
    if (range > 0) {
      const saturationThreshold = 0.95 // 95% del rango
      const saturatedCount = channelValues.filter(v => 
        Math.abs(v - maxVal) < range * 0.05 || Math.abs(v - minVal) < range * 0.05
      ).length
      const saturationProportion = saturatedCount / channelValues.length
      if (saturationProportion > 0.1) { // Más del 10% saturado
        return {
          status: 'RECHAZADA',
          mensaje: `Canal ${channel} muestra saturación: ${(saturationProportion * 100).toFixed(1)}%`,
          razon_rechazo: 'Señal saturada',
        }
      }
    }
  }

  return {
    status: 'OK',
    mensaje: 'Señal válida',
    duracion_segundos: durationSeconds,
    fs_original: fs,
  }
}

/**
 * Filtro notch (rechazo de banda) para eliminar ruido de red eléctrica
 * Implementación simple usando filtro IIR de segundo orden
 */
function applyNotchFilter(signal: number[], fs: number, notchFreq: number = 50, Q: number = 30): number[] {
  // Frecuencia normalizada
  const w0 = (2 * Math.PI * notchFreq) / fs
  const alpha = Math.sin(w0) / (2 * Q)
  const cosw0 = Math.cos(w0)

  // Coeficientes del filtro notch
  const b0 = 1
  const b1 = -2 * cosw0
  const b2 = 1
  const a0 = 1 + alpha
  const a1 = -2 * cosw0
  const a2 = 1 - alpha

  // Normalizar coeficientes
  const b = [b0 / a0, b1 / a0, b2 / a0]
  const a = [1, a1 / a0, a2 / a0]

  // Aplicar filtro IIR (implementación directa)
  const filtered = new Array(signal.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0

  for (let i = 0; i < signal.length; i++) {
    const x = signal[i]
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
    filtered[i] = y

    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
  }

  return filtered
}

/**
 * Filtro pasa banda para ECG (0.5 - 40 Hz)
 * Implementación usando filtros Butterworth de segundo orden en cascada
 */
function applyBandpassFilter(signal: number[], fs: number, lowFreq: number = 0.5, highFreq: number = 40): number[] {
  // Primero aplicar filtro pasa altas (high-pass)
  const highPassed = applyHighPassFilter(signal, fs, lowFreq)
  // Luego aplicar filtro pasa bajas (low-pass)
  return applyLowPassFilter(highPassed, fs, highFreq)
}

function applyHighPassFilter(signal: number[], fs: number, cutoffFreq: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoffFreq)
  const dt = 1 / fs
  const alpha = rc / (rc + dt)

  const filtered = new Array(signal.length)
  filtered[0] = signal[0]

  for (let i = 1; i < signal.length; i++) {
    filtered[i] = alpha * (filtered[i - 1] + signal[i] - signal[i - 1])
  }

  return filtered
}

function applyLowPassFilter(signal: number[], fs: number, cutoffFreq: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoffFreq)
  const dt = 1 / fs
  const alpha = dt / (rc + dt)

  const filtered = new Array(signal.length)
  filtered[0] = signal[0]

  for (let i = 1; i < signal.length; i++) {
    filtered[i] = filtered[i - 1] + alpha * (signal[i] - filtered[i - 1])
  }

  return filtered
}

/**
 * Etapa 2: Filtrado de la señal
 */
export function filterSignal(signal: ECGSignal, fs: number): { filtered: ECGSignal; result: FilterResult } {
  try {
    const numSamples = signal.length
    const numChannels = signal[0]?.length || 3

    const filtered: ECGSignal = []

    for (let i = 0; i < numSamples; i++) {
      filtered.push(new Array(numChannels))
    }

    // Aplicar filtros a cada canal
    for (let channel = 0; channel < numChannels; channel++) {
      const channelSignal = signal.map(sample => sample[channel])

      // Aplicar notch filter (50 Hz o 60 Hz según la región)
      // Detectar frecuencia de red basándose en fs (asumimos 50 Hz para Europa, 60 Hz para América)
      const notchFreq = fs > 300 ? 60 : 50
      const notchFiltered = applyNotchFilter(channelSignal, fs, notchFreq)

      // Aplicar filtro pasa banda (0.5 - 40 Hz para ECG)
      const bandpassFiltered = applyBandpassFilter(notchFiltered, fs, 0.5, 40)

      // Guardar resultado
      for (let i = 0; i < numSamples; i++) {
        filtered[i][channel] = bandpassFiltered[i]
      }
    }

    return {
      filtered,
      result: {
        status: 'OK',
        mensaje: 'Filtrado completado exitosamente',
        filtros_aplicados: ['notch', 'banda_pasante'],
      },
    }
  } catch (error) {
    return {
      filtered: signal, // Devolver señal original en caso de error
      result: {
        status: 'ERROR',
        mensaje: `Error en filtrado: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        filtros_aplicados: [],
      },
    }
  }
}

/**
 * Etapa 3: Normalización de la señal
 * Normaliza cada canal independientemente usando z-score
 */
export function normalizeSignal(signal: ECGSignal): { normalized: ECGSignal; result: NormalizationResult } {
  try {
    const numSamples = signal.length
    const numChannels = signal[0]?.length || 3

    const normalized: ECGSignal = []

    for (let i = 0; i < numSamples; i++) {
      normalized.push(new Array(numChannels))
    }

    // Normalizar cada canal independientemente
    for (let channel = 0; channel < numChannels; channel++) {
      const channelValues = signal.map(sample => sample[channel]).filter(v => isFinite(v) && !isNaN(v))
      
      if (channelValues.length === 0) {
        // Si el canal está vacío, copiar valores originales
        for (let i = 0; i < numSamples; i++) {
          normalized[i][channel] = signal[i][channel]
        }
        continue
      }

      // Calcular media y desviación estándar
      const mean = channelValues.reduce((a, b) => a + b, 0) / channelValues.length
      const variance = channelValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channelValues.length
      const stdDev = Math.sqrt(variance) || 1 // Evitar división por cero

      // Aplicar normalización z-score
      for (let i = 0; i < numSamples; i++) {
        const value = signal[i][channel]
        if (isFinite(value) && !isNaN(value)) {
          normalized[i][channel] = (value - mean) / stdDev
        } else {
          normalized[i][channel] = 0 // Reemplazar NaN/Inf con 0
        }
      }
    }

    return {
      normalized,
      result: {
        status: 'OK',
        mensaje: 'Normalización completada exitosamente',
        metodo: 'z-score (por canal)',
      },
    }
  } catch (error) {
    return {
      normalized: signal, // Devolver señal original en caso de error
      result: {
        status: 'ERROR',
        mensaje: `Error en normalización: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        metodo: 'ninguno',
      },
    }
  }
}

/**
 * Etapa 4: Resampling a 200 Hz
 * Implementación simple usando interpolación lineal
 */
export function resampleTo200Hz(
  signal: ECGSignal,
  originalFs: number
): { resampled: ECGSignal; result: ResamplingResult } {
  const targetFs = 200
  const numChannels = signal[0]?.length || 3
  const originalSamples = signal.length

  try {
    // Si ya está a 200 Hz, no hacer nada
    if (Math.abs(originalFs - targetFs) < 0.1) {
      return {
        resampled: signal,
        result: {
          status: 'OK',
          mensaje: 'Señal ya está a 200 Hz',
          fs_final: targetFs,
          muestras_originales: originalSamples,
          muestras_finales: originalSamples,
        },
      }
    }

    // Calcular número de muestras objetivo
    const duration = originalSamples / originalFs
    const targetSamples = Math.round(duration * targetFs)

    const resampled: ECGSignal = []

    // Resamplear cada canal
    for (let channel = 0; channel < numChannels; channel++) {
      const channelSignal = signal.map(sample => sample[channel])
      const resampledChannel = new Array(targetSamples)

      for (let i = 0; i < targetSamples; i++) {
        // Calcular posición en la señal original
        const t = (i / targetFs) * originalFs

        // Interpolación lineal
        const index = Math.floor(t)
        const fraction = t - index

        if (index >= originalSamples - 1) {
          // Si estamos al final, usar el último valor
          resampledChannel[i] = channelSignal[originalSamples - 1]
        } else {
          // Interpolación lineal
          resampledChannel[i] = channelSignal[index] * (1 - fraction) + channelSignal[index + 1] * fraction
        }
      }

      // Si es el primer canal, inicializar el array de resampled
      if (channel === 0) {
        for (let i = 0; i < targetSamples; i++) {
          resampled.push(new Array(numChannels))
        }
      }

      // Guardar canal resampleado
      for (let i = 0; i < targetSamples; i++) {
        resampled[i][channel] = resampledChannel[i]
      }
    }

    return {
      resampled,
      result: {
        status: 'OK',
        mensaje: `Resampling completado: ${originalFs} Hz → ${targetFs} Hz`,
        fs_final: targetFs,
        muestras_originales: originalSamples,
        muestras_finales: targetSamples,
      },
    }
  } catch (error) {
    return {
      resampled: signal, // Devolver señal original en caso de error
      result: {
        status: 'ERROR',
        mensaje: `Error en resampling: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        fs_final: originalFs,
        muestras_originales: originalSamples,
        muestras_finales: originalSamples,
      },
    }
  }
}

/**
 * Convertir señal a formato de entrada del modelo: [1, 2000, 3]
 * Si la señal tiene más de 2000 muestras, se trunca. Si tiene menos, se rellena con ceros.
 */
export function convertToModelInput(signal: ECGSignal, targetLength: number = 2000): number[][][] {
  const numChannels = signal[0]?.length || 3
  const currentLength = signal.length

  const modelInput: number[][][] = [[]]

  // Crear array de 2000 muestras
  for (let i = 0; i < targetLength; i++) {
    modelInput[0].push(new Array(numChannels))

    if (i < currentLength) {
      // Copiar muestra existente
      for (let channel = 0; channel < numChannels; channel++) {
        modelInput[0][i][channel] = signal[i][channel] || 0
      }
    } else {
      // Rellenar con ceros si es necesario
      for (let channel = 0; channel < numChannels; channel++) {
        modelInput[0][i][channel] = 0
      }
    }
  }

  return modelInput
}


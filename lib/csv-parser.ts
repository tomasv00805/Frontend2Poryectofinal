/**
 * Utilidades para parsear archivos CSV de ECG
 */

import Papa from 'papaparse'
import { RawECGData, ECGSignal } from '@/types/ecg'

/**
 * Parsea un archivo CSV de ECG y lo convierte al formato estándar
 */
export function parseECGCSV(csvContent: string): { data: RawECGData; fs: number } {
  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  })

  if (parsed.errors.length > 0) {
    throw new Error(`Error parseando CSV: ${parsed.errors.map(e => e.message).join(', ')}`)
  }

  const rows = parsed.data as any[]
  if (rows.length === 0) {
    throw new Error('El CSV está vacío')
  }

  // Extraer columnas
  const tiempo_s: number[] = []
  const II: number[] = []
  const V1: number[] = []
  const V5: number[] = []

  for (const row of rows) {
    if (row.tiempo_s !== undefined && row.tiempo_s !== null) {
      tiempo_s.push(Number(row.tiempo_s))
    }
    if (row.II !== undefined && row.II !== null) {
      II.push(Number(row.II))
    }
    if (row.V1 !== undefined && row.V1 !== null) {
      V1.push(Number(row.V1))
    }
    if (row.V5 !== undefined && row.V5 !== null) {
      V5.push(Number(row.V5))
    }
  }

  // Validar que tenemos datos
  if (tiempo_s.length === 0 || II.length === 0 || V1.length === 0 || V5.length === 0) {
    throw new Error('El CSV no contiene las columnas requeridas: tiempo_s, II, V1, V5')
  }

  // Calcular frecuencia de muestreo
  let fs = 500 // Valor por defecto
  if (tiempo_s.length > 1) {
    const timeDiff = tiempo_s[1] - tiempo_s[0]
    if (timeDiff > 0) {
      fs = 1 / timeDiff
    }
  }

  return {
    data: {
      tiempo_s,
      II,
      V1,
      V5,
    },
    fs,
  }
}

/**
 * Convierte RawECGData a ECGSignal (formato estándar [muestras, 3 canales])
 */
export function rawECGToSignal(rawData: RawECGData): ECGSignal {
  const numSamples = Math.min(rawData.II.length, rawData.V1.length, rawData.V5.length)
  const signal: ECGSignal = []

  for (let i = 0; i < numSamples; i++) {
    signal.push([
      rawData.II[i] || 0,
      rawData.V1[i] || 0,
      rawData.V5[i] || 0,
    ])
  }

  return signal
}

/**
 * Parsea un archivo CSV desde un File object (usado en el frontend)
 */
export async function parseECGFile(file: File): Promise<{ data: RawECGData; fs: number }> {
  const text = await file.text()
  return parseECGCSV(text)
}


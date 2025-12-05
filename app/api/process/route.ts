/**
 * API Route: /api/process
 * Procesa un ECG crudo a través del pipeline completo y llama a SageMaker
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseECGCSV, rawECGToSignal } from '@/lib/csv-parser'
import {
  checkQuality,
  filterSignal,
  normalizeSignal,
  resampleTo200Hz,
  convertToModelInput,
} from '@/lib/signal-processing'
import { invokeSageMaker } from '@/lib/sagemaker-client'
import { getModelById, getDefaultModel } from '@/lib/models'
import { ProcessingResponse, ECGSignal } from '@/types/ecg'

export const runtime = 'nodejs' // Asegurar que se ejecute en Node.js runtime

export async function POST(request: NextRequest) {
  try {
    // Parsear request body
    const body = await request.json()
    const { csvContent, modelId } = body

    if (!csvContent) {
      return NextResponse.json(
        { error: 'csvContent es requerido' },
        { status: 400 }
      )
    }

    // 1. Parsear CSV
    const { data: rawData, fs: originalFs } = parseECGCSV(csvContent)
    const signalOriginal: ECGSignal = rawECGToSignal(rawData)

    // 2. Etapa 1: Chequeo de calidad
    const qualityCheck = checkQuality(signalOriginal, originalFs)
    if (qualityCheck.status === 'RECHAZADA') {
      return NextResponse.json({
        signal_original: signalOriginal,
        signal_filtrada: null,
        signal_normalizada: null,
        signal_resampleada: null,
        tensor_final: undefined,
        estados: {
          calidad: qualityCheck,
          filtrado: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en calidad', filtros_aplicados: [] },
          normalizacion: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en calidad', metodo: 'ninguno' },
          resampling: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en calidad', fs_final: originalFs, muestras_originales: signalOriginal.length, muestras_finales: signalOriginal.length },
        },
        prediccion: null,
        modelo: {
          nombre: 'N/A',
          endpoint: 'N/A',
        },
      } as ProcessingResponse)
    }

    // 3. Etapa 2: Filtrado
    const { filtered: signalFiltrada, result: filterResult } = filterSignal(signalOriginal, originalFs)
    if (filterResult.status === 'ERROR') {
      return NextResponse.json({
        signal_original: signalOriginal,
        signal_filtrada: signalFiltrada,
        signal_normalizada: null,
        signal_resampleada: null,
        tensor_final: undefined,
        estados: {
          calidad: qualityCheck,
          filtrado: filterResult,
          normalizacion: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en filtrado', metodo: 'ninguno' },
          resampling: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en filtrado', fs_final: originalFs, muestras_originales: signalOriginal.length, muestras_finales: signalOriginal.length },
        },
        prediccion: null,
        modelo: {
          nombre: 'N/A',
          endpoint: 'N/A',
        },
      } as ProcessingResponse)
    }

    // 4. Etapa 3: Normalización
    const { normalized: signalNormalizada, result: normalizationResult } = normalizeSignal(signalFiltrada)
    if (normalizationResult.status === 'ERROR') {
      return NextResponse.json({
        signal_original: signalOriginal,
        signal_filtrada: signalFiltrada,
        signal_normalizada: signalNormalizada,
        signal_resampleada: null,
        tensor_final: undefined,
        estados: {
          calidad: qualityCheck,
          filtrado: filterResult,
          normalizacion: normalizationResult,
          resampling: { status: 'ERROR', mensaje: 'No se procesó debido a fallo en normalización', fs_final: originalFs, muestras_originales: signalOriginal.length, muestras_finales: signalOriginal.length },
        },
        prediccion: null,
        modelo: {
          nombre: 'N/A',
          endpoint: 'N/A',
        },
      } as ProcessingResponse)
    }

    // 5. Etapa 4: Resampling a 200 Hz
    const { resampled: signalResampleada, result: resamplingResult } = resampleTo200Hz(signalNormalizada, originalFs)
    if (resamplingResult.status === 'ERROR') {
      return NextResponse.json({
        signal_original: signalOriginal,
        signal_filtrada: signalFiltrada,
        signal_normalizada: signalNormalizada,
        signal_resampleada: signalResampleada,
        tensor_final: undefined,
        estados: {
          calidad: qualityCheck,
          filtrado: filterResult,
          normalizacion: normalizationResult,
          resampling: resamplingResult,
        },
        prediccion: null,
        modelo: {
          nombre: 'N/A',
          endpoint: 'N/A',
        },
      } as ProcessingResponse)
    }

    // 6. Convertir a formato del modelo [1, 2000, 3]
    const modelInput = convertToModelInput(signalResampleada, 2000)

    // Preparar información del tensor final para visualización
    const tensorInfo = {
      shape: [1, modelInput[0].length, modelInput[0][0]?.length || 3],
      muestra_preview: modelInput, // Tensor completo para visualización
    }

    // 7. Llamar a SageMaker
    let prediccion = null
    let modeloInfo = {
      nombre: 'N/A',
      endpoint: 'N/A',
      metadata: {},
    }

    try {
      const sagemakerResponse = await invokeSageMaker(modelInput, modelId)
      
      // Obtener información del modelo
      const modelConfig = modelId ? getModelById(modelId) : getDefaultModel()
      if (modelConfig) {
        modeloInfo = {
          nombre: modelConfig.nombre,
          endpoint: modelConfig.endpoint,
          metadata: modelConfig.metadata || {},
        }
      }

      // Procesar respuesta de SageMaker
      const probability = sagemakerResponse.probability ?? sagemakerResponse.prediction ?? 0
      const clase = probability > 0.5 ? 'anomalo' : 'normal'

      prediccion = {
        clase,
        score: probability,
      }
    } catch (sagemakerError) {
      console.error('Error llamando a SageMaker:', sagemakerError)
      // Continuar sin predicción, pero reportar el error
    }

    // 8. Construir respuesta completa
    const response: ProcessingResponse = {
      signal_original: signalOriginal,
      signal_filtrada: signalFiltrada,
      signal_normalizada: signalNormalizada,
      signal_resampleada: signalResampleada,
      tensor_final: tensorInfo,
      estados: {
        calidad: qualityCheck,
        filtrado: filterResult,
        normalizacion: normalizationResult,
        resampling: resamplingResult,
      },
      prediccion,
      modelo: modeloInfo,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error procesando ECG:', error)
    return NextResponse.json(
      {
        error: 'Error procesando ECG',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}



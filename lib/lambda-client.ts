/**
 * Cliente para llamar a Lambda a través de API Gateway
 * El frontend solo muestra resultados, todo el procesamiento está en Lambda
 */

import { ProcessingResponse } from '@/types/ecg'

/**
 * Obtiene la URL de la API desde variables de entorno
 */
const getApiUrl = (): string => {
  // En producción, usar variable de entorno
  let apiUrl = process.env.NEXT_PUBLIC_LAMBDA_API_URL || 
    'https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com'
  
  // Si la URL no termina con /process, agregarlo automáticamente
  if (apiUrl && !apiUrl.endsWith('/process')) {
    // Remover / al final si existe, luego agregar /process
    apiUrl = apiUrl.replace(/\/$/, '') + '/process'
  }
  
  return apiUrl
}

/**
 * Procesa un ECG completo llamando a Lambda
 * Lambda hace TODO el procesamiento: parsear CSV, procesar señal, llamar a SageMaker
 * 
 * @param csvContent - Contenido del archivo CSV
 * @param modelId - ID del modelo a usar (opcional)
 * @returns Respuesta completa con todas las etapas procesadas
 */
export async function processECG(
  csvContent: string,
  modelId?: string
): Promise<ProcessingResponse> {
  const apiUrl = getApiUrl()
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvContent,
        modelId: modelId || 'default',
      }),
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || errorData.message || `Error ${response.status}`)
    }
    
    const data: ProcessingResponse = await response.json()
    return data
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Error de conexión con Lambda API.\n\n` +
        `URL configurada: ${apiUrl}\n\n` +
        `Verifica:\n` +
        `1. Que la URL en .env.local sea correcta (NEXT_PUBLIC_LAMBDA_API_URL)\n` +
        `2. Que API Gateway esté desplegada\n` +
        `3. Que CORS esté habilitado en API Gateway\n` +
        `4. Que la ruta POST /process exista en API Gateway`
      )
    }
    throw error
  }
}


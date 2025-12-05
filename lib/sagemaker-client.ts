/**
 * Cliente para invocar endpoint de SageMaker
 * Usa AWS SDK v3 para llamar directamente al endpoint
 */

import { SageMakerRuntimeClient, InvokeEndpointCommand } from '@aws-sdk/client-sagemaker-runtime'
import { ModelInput, SageMakerResponse } from '@/types/ecg'

// Cliente singleton
let sagemakerClient: SageMakerRuntimeClient | null = null

function getSageMakerClient(): SageMakerRuntimeClient {
  if (!sagemakerClient) {
    const region = process.env.AWS_REGION || 'us-east-1'
    
    // Configurar credenciales
    // En Vercel, estas deben estar en variables de entorno
    const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined

    sagemakerClient = new SageMakerRuntimeClient({
      region,
      credentials,
    })
  }
  return sagemakerClient
}

/**
 * Invoca el endpoint de SageMaker con los datos del ECG procesado
 */
export async function invokeSageMaker(
  modelInput: ModelInput,
  modelId?: string
): Promise<SageMakerResponse> {
  const endpointUrl = process.env.SAGEMAKER_ENDPOINT_URL || 
    'https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/cnn1d-lstm-ecg-v1-serverless/invocations'

  // Extraer nombre del endpoint de la URL
  // Formato: https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/{endpoint-name}/invocations
  const endpointMatch = endpointUrl.match(/\/endpoints\/([^\/]+)\/invocations/)
  const endpointName = endpointMatch ? endpointMatch[1] : 'cnn1d-lstm-ecg-v1-serverless'

  // Preparar payload en el formato que espera el modelo
  const payload = {
    signals: modelInput, // Formato: [[[2000 muestras, 3 canales]]]
  }

  try {
    const client = getSageMakerClient()
    
    const command = new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'application/json',
      Body: JSON.stringify(payload),
    })

    const response = await client.send(command)

    // Leer respuesta
    const responseBody = response.Body
    if (!responseBody) {
      throw new Error('Respuesta vacía de SageMaker')
    }

    // Convertir a string y parsear JSON
    const responseText = await responseBody.transformToString()
    const result: SageMakerResponse = JSON.parse(responseText)

    return result
  } catch (error) {
    console.error('Error invocando SageMaker:', error)
    throw new Error(
      `Error invocando endpoint de SageMaker: ${error instanceof Error ? error.message : 'Error desconocido'}`
    )
  }
}


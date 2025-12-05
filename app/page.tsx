'use client'

import { useState, useRef } from 'react'
import ECGVisualization from '@/components/ECGVisualization'
import ProcessingStage from '@/components/ProcessingStage'
import { ProcessingResponse } from '@/types/ecg'
import { processECG } from '@/lib/lambda-client'

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ProcessingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    setError(null)
    setResponse(null)

    try {
      const text = await file.text()
      setCsvContent(text)
    } catch (err) {
      setError('Error leyendo archivo: ' + (err instanceof Error ? err.message : 'Error desconocido'))
    }
  }

  const handleProcess = async () => {
    if (!csvContent) {
      setError('Por favor, selecciona un archivo CSV primero')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      // Llamar a Lambda - TODO el procesamiento se hace en Lambda
      const data = await processECG(csvContent, 'default')
      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadExampleECG = async (filename: string) => {
    try {
      // Cargar ejemplo desde la API
      const res = await fetch(`/api/examples/${filename}`)
      if (!res.ok) throw new Error('No se pudo cargar el ejemplo')
      
      const text = await res.text()
      setCsvContent(text)
      setError(null)
      setResponse(null)
    } catch (err) {
      setError('Error cargando ejemplo: ' + (err instanceof Error ? err.message : 'Error desconocido'))
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-ecg-green to-ecg-blue">
            🫀 Procesamiento de ECG
          </h1>
          <p className="text-gray-400">
            Pipeline completo de procesamiento de señales ECG con detección de anomalías
          </p>
        </header>

        {/* Upload Section */}
        <section className="mb-8">
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <h2 className="text-2xl font-semibold mb-4 text-gray-200">1. Cargar ECG Crudo</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Seleccionar archivo CSV
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-ecg-green file:text-black hover:file:bg-ecg-blue cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O cargar un ejemplo:
                </label>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => loadExampleECG('mimic_19706335_48374752.csv')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
                  >
                    Ejemplo MIMIC 1
                  </button>
                  <button
                    onClick={() => loadExampleECG('mimic_19648488_41531395.csv')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
                  >
                    Ejemplo MIMIC 2
                  </button>
                  <button
                    onClick={() => loadExampleECG('ptbxl_20991.csv')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
                  >
                    Ejemplo PTB-XL 1
                  </button>
                  <button
                    onClick={() => loadExampleECG('ptbxl_9036.csv')}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 transition-colors"
                  >
                    Ejemplo PTB-XL 2
                  </button>
                </div>
              </div>

              {csvFile && (
                <p className="text-sm text-gray-400">
                  Archivo seleccionado: <span className="text-ecg-green">{csvFile.name}</span>
                </p>
              )}

              <button
                onClick={handleProcess}
                disabled={!csvContent || loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-ecg-green to-ecg-blue text-black font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {loading ? '🔄 Procesando...' : '🚀 Procesar ECG'}
              </button>
            </div>
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400">❌ Error: {error}</p>
          </div>
        )}

        {/* Processing Results */}
        {response && (
          <div className="space-y-6">
            {/* Etapa 1: Señal Original */}
            <ProcessingStage
              title="Etapa 1: Señal Original"
              status={response.estados.calidad.status === 'OK' ? 'ok' : 'error'}
              message={response.estados.calidad.mensaje}
            >
              <ECGVisualization
                signal={response.signal_original}
                title="ECG Crudo"
                fs={response.estados.calidad.fs_original || 500}
              />
            </ProcessingStage>

            {/* Etapa 2: Señal Filtrada */}
            {response.signal_filtrada && (
              <ProcessingStage
                title="Etapa 2: Señal Filtrada"
                status={response.estados.filtrado.status === 'OK' ? 'ok' : 'error'}
                message={`${response.estados.filtrado.mensaje} - Filtros: ${response.estados.filtrado.filtros_aplicados.join(', ')}`}
              >
                <ECGVisualization
                  signal={response.signal_filtrada}
                  title="ECG Filtrado"
                  fs={response.estados.calidad.fs_original || 500}
                />
              </ProcessingStage>
            )}

            {/* Etapa 3: Señal Normalizada */}
            {response.signal_normalizada && (
              <ProcessingStage
                title="Etapa 3: Señal Normalizada"
                status={response.estados.normalizacion.status === 'OK' ? 'ok' : 'error'}
                message={`${response.estados.normalizacion.mensaje} - Método: ${response.estados.normalizacion.metodo}`}
              >
                <ECGVisualization
                  signal={response.signal_normalizada}
                  title="ECG Normalizado"
                  fs={response.estados.calidad.fs_original || 500}
                />
              </ProcessingStage>
            )}

            {/* Etapa 4: Señal Resampleada */}
            {response.signal_resampleada && (
              <ProcessingStage
                title="Etapa 4: Señal Resampleada (200 Hz)"
                status={response.estados.resampling.status === 'OK' ? 'ok' : 'error'}
                message={`${response.estados.resampling.mensaje} - Muestras: ${response.estados.resampling.muestras_originales} → ${response.estados.resampling.muestras_finales}`}
              >
                <ECGVisualization
                  signal={response.signal_resampleada}
                  title="ECG Resampleado a 200 Hz"
                  fs={200}
                />
              </ProcessingStage>
            )}

            {/* Etapa 5: Tensor Final (Preparado para el Modelo) */}
            {response.tensor_final && response.signal_resampleada && (
              <ProcessingStage
                title="Etapa 5: Tensor Final (Listo para el Modelo)"
                status="ok"
                message={`Tensor convertido a formato del modelo: [${response.tensor_final.shape.join(', ')}] - Listo para enviar a SageMaker`}
              >
                <div className="space-y-4">
                  <ECGVisualization
                    signal={response.signal_resampleada}
                    title="ECG Final (Tensor [1, 2000, 3])"
                    fs={200}
                  />
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">📊 Información del Tensor</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Forma del tensor:</span>
                        <span className="ml-2 text-ecg-green font-mono">
                          [{response.tensor_final.shape.join(', ')}]
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Batch size:</span>
                        <span className="ml-2 text-gray-200">{response.tensor_final.shape[0]}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Muestras temporales:</span>
                        <span className="ml-2 text-gray-200">{response.tensor_final.shape[1]}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Canales:</span>
                        <span className="ml-2 text-gray-200">{response.tensor_final.shape[2]}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        💡 Este tensor se envía directamente al endpoint de SageMaker para la predicción
                      </p>
                    </div>
                  </div>
                </div>
              </ProcessingStage>
            )}

            {/* Resultado del Modelo */}
            {response.prediccion && (
              <div className="bg-gray-900 rounded-lg p-6 border-2 border-ecg-green">
                <h2 className="text-2xl font-semibold mb-4 text-gray-200">
                  🎯 Resultado de la Predicción
                </h2>
                <div className="space-y-4">
                  {/* Predicción Principal */}
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${
                      response.prediccion.clase === 'anomalo' ? 'text-ecg-pink' : 'text-ecg-green'
                    }`}>
                      {response.prediccion.clase === 'anomalo' ? 'ANÓMALO' : 'NORMAL'}
                    </div>
                    <div className="text-lg text-gray-300">
                      Score: <span className="font-semibold">{response.prediccion.score.toFixed(4)}</span>
                    </div>
                  </div>

                  {/* Comparación con Etiqueta Real - DESTACADA */}
                  {response.etiqueta_real && (() => {
                    const esAnomaloReal = response.etiqueta_real.is_anomalo_real ?? (response.etiqueta_real.label_real === 1)
                    const esAnomaloPredicho = response.prediccion.clase === 'anomalo'
                    const esCorrecto = esAnomaloReal === esAnomaloPredicho
                    
                    return (
                      <div className={`mt-6 p-5 rounded-lg border-2 ${
                        esCorrecto 
                          ? 'bg-green-500/10 border-green-500' 
                          : 'bg-red-500/10 border-red-500'
                      }`}>
                        <div className="flex items-start gap-4">
                          <span className="text-4xl">{esCorrecto ? '✅' : '❌'}</span>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold mb-3 text-gray-200">
                              {esCorrecto ? '✅ PREDICCIÓN CORRECTA' : '❌ PREDICCIÓN INCORRECTA'}
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-6 mt-4">
                              <div className="bg-gray-800/50 rounded-lg p-4">
                                <span className="text-gray-400 text-sm block mb-2">📋 Etiqueta Real (del CSV):</span>
                                <div className={`text-2xl font-bold ${
                                  esAnomaloReal
                                    ? 'text-ecg-pink' 
                                    : 'text-ecg-green'
                                }`}>
                                  {esAnomaloReal ? 'ANÓMALO' : 'NORMAL'}
                                </div>
                                {response.etiqueta_real.label_real !== undefined && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Label: {response.etiqueta_real.label_real}
                                  </div>
                                )}
                              </div>
                              
                              <div className="bg-gray-800/50 rounded-lg p-4">
                                <span className="text-gray-400 text-sm block mb-2">🤖 Predicción del Modelo:</span>
                                <div className={`text-2xl font-bold ${
                                  esAnomaloPredicho ? 'text-ecg-pink' : 'text-ecg-green'
                                }`}>
                                  {esAnomaloPredicho ? 'ANÓMALO' : 'NORMAL'}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Score: {response.prediccion.score.toFixed(4)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-gray-700">
                              <div className="text-sm text-gray-400">
                                <strong>Comparación:</strong> El modelo predijo <strong className="text-gray-200">
                                  {esAnomaloPredicho ? 'ANÓMALO' : 'NORMAL'}
                                </strong> y la etiqueta real es <strong className="text-gray-200">
                                  {esAnomaloReal ? 'ANÓMALO' : 'NORMAL'}
                                </strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Si no hay etiqueta real */}
                  {!response.etiqueta_real && (
                    <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                      <p className="text-sm text-gray-400">
                        ℹ️ El CSV no contiene información de etiqueta real (label/is_anomalo). 
                        No se puede comparar la predicción con la verdad.
                      </p>
                    </div>
                  )}

                  <div className="text-sm text-gray-400 mt-4 pt-4 border-t border-gray-800">
                    <p><strong>Modelo:</strong> {response.modelo.nombre}</p>
                    <p><strong>Endpoint:</strong> {response.modelo.endpoint}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}


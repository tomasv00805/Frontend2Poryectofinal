'use client'

import { useEffect, useRef } from 'react'
import { ECGSignal } from '@/types/ecg'

interface ECGVisualizationProps {
  signal: ECGSignal | null
  title: string
  width?: number
  height?: number
  fs?: number
  showStats?: boolean
}

export default function ECGVisualization({
  signal,
  title,
  width = 1200,
  height = 400,
  fs = 200,
  showStats = true,
}: ECGVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!signal || !signal.length || !canvasRef.current) {
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    // Limpiar canvas
    ctx.clearRect(0, 0, width, height)

    // Fondo oscuro
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    const numSamples = signal.length
    const numChannels = signal[0]?.length || 3

    // Colores para cada canal
    const colors = ['#00ff88', '#ff6b9d', '#4da6ff'] // Verde, Rosa, Azul
    const channelNames = ['II', 'V1', 'V5']

    // Configuración del gráfico
    const padding = 60
    const plotWidth = width - padding * 2
    const plotHeight = (height - padding * 2) / numChannels
    const timeStep = plotWidth / numSamples

    // Dibujar cada canal
    for (let channel = 0; channel < numChannels; channel++) {
      const yOffset = padding + channel * (plotHeight + padding / 3)

      // Extraer valores del canal
      const channelValues = signal.map(sample => sample[channel] || 0).filter(v => isFinite(v) && !isNaN(v))
      
      if (channelValues.length === 0) continue

      // Encontrar min y max para normalizar
      const min = Math.min(...channelValues)
      const max = Math.max(...channelValues)
      const range = max - min || 1

      // Dibujar grid horizontal con valores del eje Y
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 0.5
      const gridLines = 5
      for (let i = 0; i <= gridLines; i++) {
        const y = yOffset + (plotHeight / gridLines) * i
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(width - padding, y)
        ctx.stroke()
        
        // Agregar etiquetas de valores en el eje Y
        const value = max - (i / gridLines) * range
        ctx.fillStyle = '#666'
        ctx.font = '10px monospace'
        ctx.textAlign = 'right'
        ctx.fillText(value.toFixed(3), padding - 5, y + 3)
      }

      // Dibujar grid vertical
      const timeLines = 10
      for (let i = 0; i <= timeLines; i++) {
        const x = padding + (plotWidth / timeLines) * i
        ctx.beginPath()
        ctx.moveTo(x, yOffset)
        ctx.lineTo(x, yOffset + plotHeight)
        ctx.stroke()
      }

      // Dibujar la señal
      ctx.strokeStyle = colors[channel]
      ctx.lineWidth = 1.5
      ctx.beginPath()

      for (let i = 0; i < numSamples; i++) {
        const value = signal[i]?.[channel]
        if (value === undefined || !isFinite(value) || isNaN(value)) continue

        const x = padding + i * timeStep
        const normalized = (value - min) / range
        const y = yOffset + plotHeight - normalized * plotHeight

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()

      // Etiqueta del canal
      ctx.fillStyle = colors[channel]
      ctx.font = '14px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(channelNames[channel], 10, yOffset + 15)
    }

    // Dibujar eje X (tiempo)
    ctx.strokeStyle = '#666'
    ctx.fillStyle = '#999'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.beginPath()
    ctx.moveTo(padding, height - padding / 2)
    ctx.lineTo(width - padding, height - padding / 2)
    ctx.stroke()
    
    const duration = numSamples / fs
    ctx.fillText(`Tiempo (${duration.toFixed(1)} segundos, ${fs} Hz)`, width / 2, height - 10)

    // Información
    ctx.textAlign = 'left'
    ctx.fillStyle = '#666'
    ctx.font = '10px monospace'
    ctx.fillText(`${numSamples} muestras, ${numChannels} canales`, padding, 20)
  }, [signal, width, height, fs])

  if (!signal || !signal.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-900 rounded-lg border border-gray-800">
        <p className="text-gray-500">No hay datos para mostrar</p>
      </div>
    )
  }

  // Calcular estadísticas para mostrar
  const stats = showStats ? (() => {
    const allValues = signal.flat().filter(v => isFinite(v) && !isNaN(v))
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length
    const variance = allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length
    const stdDev = Math.sqrt(variance)
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const range = max - min

    return { mean, stdDev, min, max, range, numSamples: signal.length }
  })() : null

  return (
    <div className="ecg-visualization">
      <h3 className="text-lg font-semibold mb-2 text-gray-200">{title}</h3>
      <canvas
        ref={canvasRef}
        className="border border-gray-800 rounded-lg bg-gray-900"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {showStats && stats && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">Muestras</div>
            <div className="text-ecg-green font-mono">{stats.numSamples}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">Media</div>
            <div className="text-gray-200 font-mono">{stats.mean.toFixed(4)}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">Std Dev</div>
            <div className="text-gray-200 font-mono">{stats.stdDev.toFixed(4)}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">Rango</div>
            <div className="text-gray-200 font-mono">{stats.range.toFixed(4)}</div>
          </div>
          <div className="bg-gray-800 rounded p-2">
            <div className="text-gray-400">Frecuencia</div>
            <div className="text-gray-200 font-mono">{fs} Hz</div>
          </div>
        </div>
      )}
    </div>
  )
}


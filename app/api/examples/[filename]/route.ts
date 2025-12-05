/**
 * API Route: /api/examples/[filename]
 * Sirve archivos de ejemplo de ECG desde el directorio público
 * En producción, estos archivos deberían estar en /public/examples/
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename
    
    // Validar nombre de archivo (prevenir path traversal)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Nombre de archivo inválido' }, { status: 400 })
    }

    // En desarrollo, leer desde el directorio del proyecto
    // En producción, estos archivos deberían estar en /public/examples/
    const examplePath = path.join(process.cwd(), '..', 'Proyecto final', 'data', 'raw_ecg_samples', filename)
    
    // Si no existe, intentar desde public/examples
    let filePath = examplePath
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), 'public', 'examples', filename)
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Archivo de ejemplo no encontrado' },
        { status: 404 }
      )
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'text/csv',
      },
    })
  } catch (error) {
    console.error('Error sirviendo ejemplo:', error)
    return NextResponse.json(
      { error: 'Error sirviendo archivo de ejemplo' },
      { status: 500 }
    )
  }
}


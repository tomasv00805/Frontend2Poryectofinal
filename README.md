# 🫀 Aplicación de Procesamiento de ECG

Aplicación completa en Next.js (TypeScript) para procesar electrocardiogramas crudos y detectar anomalías usando un modelo de SageMaker.

## 📋 Características

- ✅ Procesamiento completo de señal ECG en el servidor
- ✅ Visualización etapa por etapa del procesamiento
- ✅ Pipeline de 4 etapas: Calidad → Filtrado → Normalización → Resampling
- ✅ Integración directa con endpoint de SageMaker
- ✅ Despliegue 100% en Vercel (sin backend externo)
- ✅ UI moderna con Tailwind CSS

## 🏗️ Arquitectura

```
Frontend (Next.js/Vercel)
    ↓
    [Usuario carga CSV]
    ↓
API Gateway
    ↓
Lambda Function (ecg-processor)
    ├── 1. Parsea CSV
    ├── 2. Chequea calidad
    ├── 3. Filtra señal
    ├── 4. Normaliza
    ├── 5. Resamplea a 200 Hz
    ├── 6. Convierte a tensor [1, 2000, 3]
    ├── 7. Llama a SageMaker
    └── 8. Retorna TODOS los resultados
    ↓
Frontend (Next.js/Vercel)
    ↓
    [Muestra gráficos de cada etapa]
    [Muestra predicción final]
```

**Nota**: Todo el procesamiento se hace en Lambda (AWS). El frontend solo muestra los resultados.

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Credenciales AWS (para llamar a SageMaker)

### Instalación

1. Clonar el repositorio:
```bash
cd "S:\Proyecto Final Frontend 2"
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
SAGEMAKER_ENDPOINT_URL=https://runtime.sagemaker.us-east-1.amazonaws.com/endpoints/cnn1d-lstm-ecg-v1-serverless/invocations
```

4. Ejecutar en desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
.
├── app/
│   ├── api/
│   │   ├── process/          # API route para procesar ECG
│   │   └── examples/         # API route para servir ejemplos
│   ├── globals.css          # Estilos globales
│   ├── layout.tsx           # Layout principal
│   └── page.tsx             # Página principal
├── components/
│   ├── ECGVisualization.tsx # Componente para visualizar ECG
│   └── ProcessingStage.tsx  # Componente para mostrar etapas
├── lib/
│   ├── csv-parser.ts        # Parser de archivos CSV
│   ├── signal-processing.ts  # Pipeline de procesamiento de señal
│   ├── sagemaker-client.ts   # Cliente para SageMaker
│   └── models.ts            # Configuración de modelos
├── types/
│   └── ecg.ts               # Tipos TypeScript
└── public/
    └── examples/            # Archivos CSV de ejemplo (opcional)
```

## 🔧 Pipeline de Procesamiento

### Etapa 1: Chequeo de Calidad
- Validación de duración mínima
- Verificación de desviación estándar por canal
- Detección de valores NaN/Inf
- Detección de señales planas/constantes
- Detección de saturación

### Etapa 2: Filtrado
- **Filtro Notch**: Elimina ruido de red eléctrica (50/60 Hz)
- **Filtro Pasa Banda**: 0.5 - 40 Hz (rango de interés cardíaco)

### Etapa 3: Normalización
- Normalización z-score por canal
- Cada canal se normaliza independientemente

### Etapa 4: Resampling
- Resampling a 200 Hz (requerido por el modelo)
- Interpolación lineal para ajustar frecuencia

## 📊 Formato de Datos

### Entrada (CSV)
El archivo CSV debe tener las siguientes columnas:
- `tiempo_s`: Tiempo en segundos
- `II`: Señal de derivación II
- `V1`: Señal de derivación V1
- `V5`: Señal de derivación V5

Ejemplo:
```csv
tiempo_s,II,V1,V5
0.0,0.03,0.02,-0.015
0.002,0.04,0.02,-0.035
...
```

### Salida del Modelo
El modelo espera un tensor con forma `[1, 2000, 3]`:
- Batch size: 1
- Muestras temporales: 2000 (10 segundos a 200 Hz)
- Canales: 3 (II, V1, V5)

### Respuesta de la API
```json
{
  "signal_original": [[...], ...],
  "signal_filtrada": [[...], ...],
  "signal_normalizada": [[...], ...],
  "signal_resampleada": [[...], ...],
  "estados": {
    "calidad": { "status": "OK", "mensaje": "..." },
    "filtrado": { "status": "OK", "filtros_aplicados": [...] },
    "normalizacion": { "status": "OK", "metodo": "..." },
    "resampling": { "status": "OK", "fs_final": 200 }
  },
  "prediccion": {
    "clase": "normal" | "anomalo",
    "score": 0.87
  },
  "modelo": {
    "nombre": "...",
    "endpoint": "..."
  }
}
```

## 🌐 Despliegue en Vercel

### 1. Preparar el proyecto

Asegúrate de que el proyecto compile correctamente:
```bash
npm run build
```

### 2. Conectar con Vercel

1. Instala Vercel CLI (si no lo tienes):
```bash
npm i -g vercel
```

2. Inicia sesión:
```bash
vercel login
```

3. Despliega:
```bash
vercel
```

### 3. Configurar Variables de Entorno en Vercel

En el dashboard de Vercel:
1. Ve a tu proyecto
2. Settings → Environment Variables
3. Agrega las siguientes variables:
   - `AWS_REGION`
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `SAGEMAKER_ENDPOINT_URL`

### 4. Redesplegar

Después de configurar las variables, redespliega:
```bash
vercel --prod
```

## 🔒 Seguridad

- ✅ Las credenciales AWS **nunca** se exponen al cliente
- ✅ Todo el procesamiento se hace en el servidor (API routes)
- ✅ Las variables de entorno solo están disponibles en el servidor
- ⚠️ En producción, considera usar IAM roles en lugar de access keys

## 📝 Notas Importantes

### Limitaciones

1. **Tamaño de archivo**: Los archivos CSV muy grandes pueden causar timeouts en Vercel (límite de 10s para funciones serverless en plan gratuito)
2. **Frecuencia de muestreo**: El pipeline asume frecuencias típicas de ECG (250-500 Hz). Frecuencias muy diferentes pueden requerir ajustes
3. **Formato de tensor**: El modelo espera exactamente 2000 muestras. Si la señal procesada tiene menos, se rellena con ceros. Si tiene más, se trunca.

### Suposiciones del Código

- El CSV tiene columnas `tiempo_s`, `II`, `V1`, `V5`
- La frecuencia de muestreo se calcula automáticamente desde `tiempo_s`
- El endpoint de SageMaker espera el formato `{ "signals": [[[...]]] }`
- La respuesta de SageMaker tiene `probability` o `prediction` como campo numérico

## 🐛 Troubleshooting

### Error: "AWS credentials not configured"
- Verifica que las variables de entorno estén configuradas correctamente
- En Vercel, asegúrate de haber agregado las variables en el dashboard

### Error: "Error invocando endpoint de SageMaker"
- Verifica que el endpoint URL sea correcto
- Verifica que las credenciales AWS tengan permisos para invocar SageMaker
- Revisa los logs de Vercel para más detalles

### Error: "Señal rechazada en chequeo de calidad"
- Verifica que el CSV tenga datos válidos
- Asegúrate de que la señal tenga duración suficiente (>5 segundos)
- Verifica que no haya demasiados valores NaN o constantes

## 📚 Referencias

- [Next.js Documentation](https://nextjs.org/docs)
- [AWS SageMaker Runtime](https://docs.aws.amazon.com/sagemaker/latest/APIReference/API_runtime_InvokeEndpoint.html)
- [Vercel Deployment](https://vercel.com/docs)

## 📄 Licencia

Este proyecto es parte de un proyecto académico/final.


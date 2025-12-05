# 🚀 Preparación para Desplegar en Vercel

## ✅ Checklist Antes de Subir

### 1. Verificar que el Proyecto Compila

```bash
npm run build
```

Si hay errores, corrígelos antes de continuar.

### 2. Verificar Variables de Entorno

Asegúrate de tener configurado `.env.local` (no se sube a GitHub):

```env
NEXT_PUBLIC_LAMBDA_API_URL=https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com
```

### 3. Verificar que .gitignore está Correcto

El `.gitignore` ya está configurado para ignorar:
- ✅ Archivos de documentación/tutoriales
- ✅ Dependencias de Python en `lambda/`
- ✅ Archivos `.env`
- ✅ `node_modules`
- ✅ `.next/`
- ✅ Archivos temporales

### 4. Limpiar Archivos No Necesarios (Opcional)

Si quieres limpiar el directorio `lambda/` antes de subir:

```bash
# Eliminar dependencias de Python (no necesarias en repo)
# Ya están en .gitignore, pero puedes eliminarlas localmente
cd lambda
# Eliminar carpetas de dependencias
rm -rf boto3 botocore jmespath s3transfer urllib3 dateutil bin
rm -rf *.dist-info __pycache__ six.py
# O en Windows PowerShell:
Remove-Item -Recurse -Force boto3, botocore, jmespath, s3transfer, urllib3, dateutil, bin, *.dist-info, __pycache__ -ErrorAction SilentlyContinue
```

**Nota**: Esto solo limpia localmente. El `.gitignore` ya evita que se suban a GitHub.

## 📤 Subir a GitHub

### 1. Inicializar Git (si no está inicializado)

```bash
git init
```

### 2. Agregar Archivos

```bash
git add .
```

Esto agregará todos los archivos excepto los que están en `.gitignore`.

### 3. Verificar qué se va a Subir

```bash
git status
```

Deberías ver:
- ✅ Archivos de código (app/, components/, lib/, types/)
- ✅ Archivos de configuración (package.json, tsconfig.json, etc.)
- ✅ README.md principal
- ❌ NO deberías ver: .env.local, node_modules/, lambda/boto3/, documentación .md

### 4. Hacer Commit

```bash
git commit -m "Initial commit: ECG processing app with Lambda integration"
```

### 5. Crear Repositorio en GitHub

1. Ve a [GitHub](https://github.com)
2. Crea un nuevo repositorio
3. No inicialices con README (ya tienes uno)

### 6. Conectar y Subir

```bash
git remote add origin https://github.com/tu-usuario/tu-repositorio.git
git branch -M main
git push -u origin main
```

## 🌐 Desplegar en Vercel

### Opción 1: Desde GitHub (Recomendado)

1. Ve a [Vercel](https://vercel.com)
2. Inicia sesión con GitHub
3. Haz clic en **"Add New Project"**
4. Selecciona tu repositorio
5. Vercel detectará automáticamente que es Next.js
6. Configura:
   - **Framework Preset**: Next.js (detectado automáticamente)
   - **Root Directory**: `./` (raíz del proyecto)
   - **Build Command**: `npm run build` (automático)
   - **Output Directory**: `.next` (automático)
7. Haz clic en **"Deploy"**

### Opción 2: Desde Vercel CLI

```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Iniciar sesión
vercel login

# Desplegar
vercel

# Para producción
vercel --prod
```

### Configurar Variables de Entorno en Vercel

**IMPORTANTE**: Después de desplegar, configura las variables de entorno:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - **Name**: `NEXT_PUBLIC_LAMBDA_API_URL`
   - **Value**: `https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development
4. Haz clic en **"Save"**
5. Redespliega el proyecto (Vercel → Deployments → ... → Redeploy)

## ✅ Verificación Post-Despliegue

1. Abre la URL de tu app en Vercel
2. Intenta cargar un ECG de ejemplo
3. Verifica que se conecte a Lambda correctamente
4. Revisa los logs en Vercel si hay errores:
   - Deployments → Selecciona deployment → Functions → Ver logs

## 🐛 Problemas Comunes

### Error: "NEXT_PUBLIC_LAMBDA_API_URL is not defined"

**Solución**: Agrega la variable de entorno en Vercel (Settings → Environment Variables)

### Error: "Failed to fetch" o CORS

**Solución**: 
- Verifica que CORS esté habilitado en API Gateway
- Verifica que la URL de Lambda sea correcta
- Revisa los logs de Vercel para más detalles

### Error en Build

**Solución**:
- Ejecuta `npm run build` localmente para ver errores
- Verifica que todas las dependencias estén en `package.json`
- Revisa los logs de build en Vercel

## 📝 Notas Importantes

1. **Variables de Entorno**: 
   - Las variables que empiezan con `NEXT_PUBLIC_` son accesibles en el cliente
   - Las demás solo están disponibles en el servidor

2. **Archivos Ignorados**:
   - `.env.local` NO se sube a GitHub (está en .gitignore)
   - Debes configurar las variables en Vercel manualmente

3. **Lambda**:
   - El código de Lambda (`lambda/ecg_processor.py`) SÍ se sube a GitHub
   - Las dependencias de Python NO se suben (están en .gitignore)
   - El ZIP de Lambda NO se sube (se genera cuando lo necesites)

4. **Documentación**:
   - Los archivos `.md` de documentación NO se suben (están en .gitignore)
   - Solo `README.md` principal se mantiene

## 🎯 Resumen

1. ✅ Verifica que compila: `npm run build`
2. ✅ Sube a GitHub (sin .env.local, sin node_modules, sin documentación)
3. ✅ Conecta Vercel con GitHub
4. ✅ Configura variable de entorno `NEXT_PUBLIC_LAMBDA_API_URL` en Vercel
5. ✅ Despliega y prueba

¡Listo para producción! 🚀


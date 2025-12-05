# 🚀 Cómo Subir a Vercel - Paso a Paso

## Respuesta Simple

**Sí, básicamente solo necesitas subirlo a GitHub y conectar Vercel**. Pero hay algunos pasos importantes.

---

## 📋 Pasos Completos

### Paso 1: Verificar que Todo Funciona

```bash
npm install
npm run build
```

Si compila sin errores, sigue adelante.

### Paso 2: Subir a GitHub

```bash
# 1. Inicializar git (si no está inicializado)
git init

# 2. Agregar archivos
git add .

# 3. Ver qué se va a subir (deberías ver código, NO .env.local, NO node_modules)
git status

# 4. Hacer commit
git commit -m "ECG processing app"

# 5. Crear repositorio en GitHub:
#    - Ve a github.com
#    - Click en "+" → "New repository"
#    - Nombre: "ecg-processing-app" (o el que quieras)
#    - NO marques "Add README" (ya tienes uno)
#    - Click "Create repository"

# 6. Conectar y subir
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

### Paso 3: Conectar con Vercel

1. Ve a **[vercel.com](https://vercel.com)**
2. Inicia sesión con GitHub (haz clic en "Continue with GitHub")
3. Haz clic en **"Add New Project"**
4. Selecciona tu repositorio (el que acabas de subir)
5. Vercel detectará automáticamente que es Next.js
6. **NO cambies nada**, solo haz clic en **"Deploy"**
7. Espera 1-2 minutos mientras se despliega

### Paso 4: Configurar Variable de Entorno (MUY IMPORTANTE)

**Después del primer despliegue:**

1. En Vercel, ve a tu proyecto
2. Ve a **Settings** (Configuración) → **Environment Variables** (Variables de entorno)
3. Haz clic en **"Add New"** (Agregar nueva)
4. Completa:
   - **Name** (Nombre): `NEXT_PUBLIC_LAMBDA_API_URL`
   - **Value** (Valor): `https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com`
   - Marca todas las casillas: ✅ Production, ✅ Preview, ✅ Development
5. Haz clic en **"Save"** (Guardar)
6. Ve a **Deployments** → Selecciona el último deployment → **"..."** → **"Redeploy"**

### Paso 5: Probar

1. Abre la URL que te dio Vercel (algo como `https://tu-proyecto.vercel.app`)
2. Carga un ECG
3. Debería funcionar

---

## ⚠️ IMPORTANTE

- ✅ El `.env.local` NO se sube a GitHub (está en .gitignore)
- ✅ Debes configurar la variable de entorno **manualmente en Vercel**
- ✅ Sin la variable de entorno, la app no sabrá a dónde llamar a Lambda

---

## 🐛 Si Algo Falló

### Error: "NEXT_PUBLIC_LAMBDA_API_URL is not defined"
→ Ve a Vercel → Settings → Environment Variables → Agrega la variable

### Error: "Failed to fetch"
→ Verifica que:
  1. La variable de entorno esté configurada
  2. CORS esté habilitado en API Gateway
  3. La URL de Lambda sea correcta

### Build Falló
→ Revisa los logs en Vercel → Deployments → Selecciona el deployment → Ver logs

---

## ✅ Resumen Ultra Simple

1. `git add .` → `git commit` → `git push` (subir a GitHub)
2. Vercel → Add Project → Seleccionar repo → Deploy
3. Settings → Environment Variables → Agregar `NEXT_PUBLIC_LAMBDA_API_URL`
4. Redeploy

**¡Listo!** 🎉


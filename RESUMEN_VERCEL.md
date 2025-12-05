# 🚀 Resumen: Subir a Vercel

## Respuesta Corta

**Sí, solo subes a GitHub y Vercel hace el resto.** Pero debes configurar una variable de entorno después.

---

## 📝 Pasos (5 minutos)

### 1️⃣ Subir a GitHub

```bash
git init
git add .
git commit -m "ECG processing app"
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

*(Primero crea el repositorio en github.com)*

### 2️⃣ Conectar Vercel

1. Ve a **vercel.com** → Inicia sesión con GitHub
2. **"Add New Project"** → Selecciona tu repo
3. Click **"Deploy"** (no cambies nada)

### 3️⃣ Configurar Variable (IMPORTANTE)

**Después del despliegue:**

1. Vercel → Tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   - **Name**: `NEXT_PUBLIC_LAMBDA_API_URL`
   - **Value**: `https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com`
   - Marca todas: ✅ Production, ✅ Preview, ✅ Development
3. **Save** → **Deployments** → **Redeploy**

---

## ✅ Listo

Tu app estará en `https://tu-proyecto.vercel.app`

---

**Nota**: El `.gitignore` ya está configurado para NO subir:
- ❌ `.env.local`
- ❌ `node_modules`
- ❌ Documentación `.md` (excepto README.md)
- ❌ Dependencias de Python en `lambda/`


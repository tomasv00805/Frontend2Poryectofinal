# 🚀 Desplegar en Vercel - Guía Simple

## Pasos Rápidos

### 1️⃣ Subir a GitHub

```bash
# 1. Inicializar git (si no está inicializado)
git init

# 2. Agregar todos los archivos (el .gitignore evitará subir lo que no debe)
git add .

# 3. Verificar qué se va a subir
git status

# 4. Hacer commit
git commit -m "ECG processing app with Lambda integration"

# 5. Crear repositorio en GitHub y conectarlo
# Ve a github.com, crea un nuevo repositorio, luego:
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git branch -M main
git push -u origin main
```

### 2️⃣ Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Inicia sesión con GitHub
3. Haz clic en **"Add New Project"**
4. Selecciona tu repositorio
5. Vercel detectará automáticamente Next.js
6. **NO cambies ninguna configuración**, solo haz clic en **"Deploy"**

### 3️⃣ Configurar Variable de Entorno (IMPORTANTE)

**Después** del primer despliegue:

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Haz clic en **"Add New"**
4. Agrega:
   - **Key**: `NEXT_PUBLIC_LAMBDA_API_URL`
   - **Value**: `https://mlzzl5mzt9.execute-api.us-east-1.amazonaws.com`
   - Marca todos los ambientes: ✅ Production, ✅ Preview, ✅ Development
5. Haz clic en **"Save"**
6. Ve a **Deployments** → Selecciona el último → **"Redeploy"**

### 4️⃣ Listo

Tu aplicación estará disponible en `https://tu-proyecto.vercel.app`

---

## ✅ Checklist

- [ ] Proyecto subido a GitHub
- [ ] Vercel conectado con GitHub
- [ ] Proyecto desplegado (primer despliegue)
- [ ] Variable `NEXT_PUBLIC_LAMBDA_API_URL` configurada
- [ ] Redesplegado después de agregar variable

---

## 🐛 Si algo falla

1. **Build falla**: Revisa los logs en Vercel → Deployments
2. **Error de conexión**: Verifica que la variable de entorno esté configurada
3. **CORS error**: Verifica que CORS esté habilitado en API Gateway

---

**¡Eso es todo!** Solo sube a GitHub y conecta con Vercel. 🎉


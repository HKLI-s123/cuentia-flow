# 🚀 Guía de Deploy en Netlify

## 📋 Pre-requisitos

1. **Cuenta en Netlify** - Crea una cuenta en [netlify.com](https://netlify.com)
2. **SQL Server accesible desde internet** - Necesitas que tu base de datos SQL Server sea accesible desde internet (Azure SQL Database recomendado)
3. **Código en GitHub/GitLab** - Tu repositorio debe estar en GitHub, GitLab o Bitbucket

## ⚠️ IMPORTANTE: Base de Datos

Tu aplicación usa SQL Server (`mssql`). Para que funcione en Netlify necesitas:

- ✅ **Azure SQL Database** (Recomendado)
- ✅ **SQL Server en servidor VPS con IP pública**
- ❌ **NO funcionará con localhost o SQL Server local**

### Configurar Azure SQL Database (Recomendado):

1. Ve a [portal.azure.com](https://portal.azure.com)
2. Crea un SQL Database
3. Configura el firewall para permitir conexiones desde Azure services
4. Anota los datos de conexión:
   - Servidor: `tu-servidor.database.windows.net`
   - Usuario y contraseña
   - Nombre de base de datos

## 🛠️ Pasos para Deploy

### 1. Compilar localmente (Prueba)

```bash
# Compilar el proyecto
npm run build

# Previsualizar la compilación (opcional)
npm run preview
```

Si la compilación es exitosa, continúa al siguiente paso.

### 2. Subir a GitHub

```bash
# Inicializar git (si no está inicializado)
git init
git add .
git commit -m "Preparado para deploy en Netlify"

# Crear repositorio en GitHub y conectar
git remote add origin https://github.com/tu-usuario/tu-repo.git
git branch -M main
git push -u origin main
```

### 3. Conectar con Netlify

1. Ve a [app.netlify.com](https://app.netlify.com)
2. Click en "Add new site" → "Import an existing project"
3. Conecta con GitHub/GitLab
4. Selecciona tu repositorio
5. Netlify detectará automáticamente la configuración de SvelteKit

### 4. Configurar Variables de Entorno

En Netlify Dashboard → Site settings → Environment variables, agrega:

```
DB_SERVER=tu-servidor.database.windows.net
DB_DATABASE=Cobranza
DB_USER=tu-usuario
DB_PASSWORD=tu-password-segura
JWT_SECRET=un-secreto-muy-seguro-cambialo
```

### 5. Deploy

1. Click en "Deploy site"
2. Espera a que termine el build (2-5 minutos)
3. Netlify te dará una URL tipo: `https://tu-app.netlify.app`

## 🔧 Troubleshooting

### Error: "Cannot connect to database"

**Causa:** SQL Server no es accesible desde internet

**Solución:**
- Si usas Azure SQL, agrega la IP de Netlify al firewall
- O mejor aún, permite "Azure services and resources" en el firewall

### Error: "Build failed"

**Causa:** Falta alguna dependencia o hay errores en el código

**Solución:**
```bash
# Limpiar e instalar dependencias
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Error: "500 Internal Server Error"

**Causa:** Variables de entorno no configuradas correctamente

**Solución:**
- Verifica que todas las variables estén en Netlify
- Verifica que no tengan espacios extra
- Re-deploy después de configurarlas

## 📊 Comandos útiles

```bash
# Compilar para producción
npm run build

# Previsualizar compilación
npm run preview

# Verificar errores de TypeScript
npm run check

# Formatear código
npm run format
```

## 🔐 Seguridad

Antes de hacer deploy:

1. ✅ Verifica que `.env` esté en `.gitignore`
2. ✅ Nunca subas credenciales al repositorio
3. ✅ Usa variables de entorno en Netlify
4. ✅ Cambia `JWT_SECRET` a algo seguro y único

## 📝 Notas Importantes

- **Funciones Serverless:** Netlify usa funciones serverless para las rutas API
- **Cold Starts:** La primera petición puede ser lenta (2-3 segundos)
- **Límites:** Plan gratuito tiene límites de 125k requests/mes
- **Base de datos:** Asegúrate que SQL Server esté en la misma región que Netlify para menor latencia

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en Netlify Dashboard → Deploys → Deploy log
2. Revisa los logs de funciones en Functions → Function log
3. Verifica la conexión a SQL Server

---

¿Necesitas ayuda? Revisa la [documentación de Netlify](https://docs.netlify.com) o la [documentación de SvelteKit](https://kit.svelte.dev/docs/adapter-netlify)

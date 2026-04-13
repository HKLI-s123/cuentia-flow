# Documentación del Sistema de Cobranza

## Información General del Proyecto

### Descripción
Sistema web de gestión de cobranza desarrollado en **SvelteKit** con TypeScript, diseñado para administrar clientes, facturas, pagos y procesos de cobranza de manera eficiente.

### Tecnologías Principales
- **Frontend**: SvelteKit 2.x + TypeScript + Tailwind CSS
- **Backend**: API Routes de SvelteKit + TypeScript
- **Base de Datos**: Microsoft SQL Server (Azure/Local)
- **Autenticación**: Sessions/JWT (en desarrollo)
- **UI Components**: Chart.js, SweetAlert2, Lucide Icons
- **Herramientas**: PDF.js para procesamiento de documentos

### Estado del Proyecto
**Versión**: 0.0.1 (En desarrollo activo)
**Rama actual**: `dashboard`
**Usuario de prueba**: ID 9

---

## Arquitectura del Sistema

### Estructura del Proyecto
```
cobranza-app/
├── src/
│   ├── lib/
│   │   ├── components/          # Componentes reutilizables
│   │   │   └── Navbar.svelte   # Barra de navegación
│   │   ├── server/             # Lógica del servidor
│   │   │   ├── db.ts          # Conexión a SQL Server
│   │   │   └── getRegimen.ts  # Utilidades de régimen fiscal
│   │   └── stores/            # Stores de Svelte
│   │       └── user.ts        # Estado del usuario
│   ├── routes/                # Rutas y API endpoints
│   │   ├── api/              # API REST endpoints
│   │   │   ├── login/        # Autenticación
│   │   │   ├── agentes/      # Gestión de agentes
│   │   │   ├── usuario/      # Datos de usuario
│   │   │   ├── regimen/      # Regímenes fiscales
│   │   │   ├── paises/       # Catálogo de países
│   │   │   ├── estados/      # Catálogo de estados
│   │   │   └── config/       # Configuración del sistema
│   │   ├── dashboard/        # Panel principal (protegido)
│   │   │   ├── clientes/     # Módulo de clientes
│   │   │   └── +layout.svelte # Layout del dashboard
│   │   └── login/           # Página de login
│   └── app.d.ts            # Definiciones de tipos
├── package.json            # Dependencias y scripts
└── README.md              # Documentación básica
```

### Conexión a Base de Datos
**Archivo**: `src/lib/server/db.ts`

- **Motor**: Microsoft SQL Server
- **Configuración**: Variables de entorno (`.env`)
- **Pool de conexiones**: Singleton pattern para reutilización
- **Seguridad**: Encriptación SSL obligatoria

**Variables requeridas**:
```env
DB_USER=usuario_bd
DB_PASSWORD=contraseña_bd
DB_SERVER=servidor.database.windows.net
DB_NAME=Cobranza
```

---

## Módulos Funcionales

### 1. Sistema de Autenticación
**Estado**: Funcional básico
- Login con email/password
- Validación contra tabla `Usuarios`
- Sesiones persistentes
- Redirección automática al dashboard

**Archivos principales**:
- `src/routes/api/login/+server.ts`
- `src/routes/login/+server.ts`
- `src/hook.server.ts`

### 2. Dashboard Principal
**Estado**: Implementado
- Gráficos interactivos con Chart.js
- Métricas de cobros y pagos
- Visualizaciones: barras, líneas, pie charts
- Datos simulados para desarrollo

**Archivo**: `src/routes/dashboard/+page.svelte`

### 3. Gestión de Clientes
**Estado**:  CRUD Completo

#### Funcionalidades Implementadas:
-  **Crear clientes**: Formulario completo con validación
-  **Listar clientes**: Tabla paginada con búsqueda inteligente
-  **Editar clientes**: Modal con carga de datos completos
-  **Eliminar clientes**: Con confirmación SweetAlert2
-  **Exportar Excel**: Descarga de listado completo
-  **Procesamiento PDF**: Extracción automática de datos SAT

#### Características Técnicas:
- **Búsqueda inteligente**: Por ID, agente, RFC, razón social, etc.
- **Paginación responsive**: 5 registros por página
- **Validación en tiempo real**: Campos obligatorios y formatos
- **Modularización**: Separación en archivos TypeScript (`api.ts`, `utils.ts`, `types.ts`)

**Archivos principales**:
- `src/routes/dashboard/clientes/+page.svelte` (1,308 líneas)
- `src/routes/dashboard/clientes/api.ts`
- `src/routes/dashboard/clientes/utils.ts`
- `src/routes/dashboard/clientes/types.ts`

#### Campos del Cliente:
**Datos Fiscales:**
- Nombre comercial *, Razón social *, RFC *
- Régimen fiscal *, Condiciones de pago *

**Datos de Contacto:**
- Correo principal *, País *, Estado *
- Teléfono *, Dirección completa
- Código postal, Colonia, Ciudad

**Asignación:**
- Agente de cobranza * (selección dinámica)

### 4. Catálogos del Sistema
**Estado**:  APIs Funcionales

#### APIs Disponibles:
- **`/api/regimen`**: Regímenes fiscales SAT
- **`/api/paises`**: Catálogo de países
- **`/api/estados`**: Estados por país (dinámico)
- **`/api/agentes`**: Agentes de cobranza por organización
- **`/api/config`**: Configuración del sistema

---

## Modelo de Base de Datos

### Tablas Principales Identificadas:

#### Usuarios y Organizaciones
```sql
Usuarios (Id, Correo, Nombre, Apellido, Contrasena, Activo)
Organizaciones (Id, RFC, RazonSocial, CorreoElectronico, Nombre)
Usuario_Organizacion (UsuarioId, OrganizacionId, RolId)
Roles (Id, Nombre)
```

#### Clientes y Datos Fiscales
```sql
Clientes (Id, NombreComercial, RazonSocial, RFC, RegimenFiscal,
          CondicionesPago, CorreoPrincipal, Pais, CodigoPais,
          Telefono, Estado, Calle, NumeroExterior, NumeroInterior,
          CodigoPostal, Colonia, Ciudad)
Agentes_Clientes (ClienteId, UsuarioId, RolAgente)
```

#### Catálogos
```sql
Regimen (ID_Regimen, Codigo, Descripcion)
Paises (ID, NombrePais)
Estados (ID, ClaveEstado, NombreEstado, PaisID)
```

#### Facturación y Cobranza
```sql
Facturas (Id, ClienteId, MontoTotal, FechaEmision, FechaVencimiento)
Pagos (Id, FacturaId, UsuarioId, Monto, FechaPago, Metodo)
```

### Datos de Prueba
**Archivo**: `script_datos_cobranza_corregido.sql`

- **8 clientes** con diferentes escenarios de cobranza
- **Facturas** con diversos estados (vigentes, vencidas, en litigio)
- **Pagos** parciales y completos
- **Asignación** automática al usuario ID 6

---

## Scripts y Comandos

### Desarrollo
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Construcción para producción
npm run preview      # Vista previa de build
```

### Calidad de Código
```bash
npm run check        # Verificación de tipos TypeScript
npm run check:watch  # Verificación continua
npm run lint         # ESLint + Prettier
npm run format       # Formateo automático
```

---

## Características Técnicas

### Seguridad Implementada
- Validación de entrada en formularios
- Sanitización de datos SQL (parámetros preparados)
- Conexión SSL a base de datos
- Validación de sesiones de usuario
- Autenticación JWT (en desarrollo)

### Rendimiento y UX
- Paginación eficiente (5 registros/página)
- Búsqueda en tiempo real sin impacto en BD
- Carga asíncrona de formularios
- Indicadores de carga (spinners, SweetAlert2)
- Responsive design (móvil y desktop)

### Validaciones
-  Campos obligatorios en tiempo real
-  Formato de RFC, email, teléfono
-  Validación de relaciones (país-estado)
-  Confirmaciones para acciones destructivas

---

## Próximas Funcionalidades (Roadmap)

### Prioridad Alta
- **Módulo de Facturas**: CRUD completo
- **Módulo de Pagos**: Registro y seguimiento
- **Dashboard mejorado**: Métricas reales de BD

### Prioridad Media
- **Reportes de Cobranza**: Aging, vencimientos
- **Notificaciones**: Alertas automáticas
- **Historial de Gestiones**: Log de actividades

### Prioridad Baja
- **Configuración avanzada**: Múltiples organizaciones
- **API REST externa**: Integración con otros sistemas
- **Roles y permisos**: Sistema granular

---

## Información de Desarrollo

### Patrones de Código
- **Modularización**: Separación clara de responsabilidades
- **Tipado fuerte**: TypeScript en todos los archivos
- **Componentización**: Reutilización de componentes Svelte
- **API RESTful**: Endpoints consistentes y documentados

### Convenciones
- **Nomenclatura**: camelCase para variables, PascalCase para tipos
- **Archivos**: kebab-case para nombres de archivo
- **Componentes**: PascalCase para componentes Svelte
- **Base de datos**: PascalCase para tablas y columnas

### Contacto del Desarrollador
**Proyecto**: Sistema de Cobranza v0.0.1
**Tecnología**: SvelteKit + TypeScript + SQL Server
**Estado**: Desarrollo activo - Módulo de clientes funcional

---
*Documentación - Última actualización: Septiembre 2025*
# 📘 RegistroLab - Desktop Version

<img src="https://astro.build/assets/press/astro-icon-light.png" width="80" alt="RegistroLab Desktop Logo" />

# 🖥️ RegistroLab — Desktop

**Sistema de Gestión Lab-Somno · Aplicación de escritorio**

[![Astro](https://img.shields.io/badge/Astro-FF5D01?style=for-the-badge&logo=astro&logoColor=white)](https://astro.build/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io/)

[![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=flat-square&logo=windows)](https://github.com/irvingpoot/RegistroLab)
[![Version](https://img.shields.io/badge/version-0.0.1-informational?style=flat-square)](package.json)
[![Web version](https://img.shields.io/badge/🌐_versión_web-RegistroLab-purple?style=flat-square)](https://github.com/irvingpoot/RegistroLab)

[🐛 Reportar bug](https://github.com/irvingpoot/RegistroLab/issues) · [💡 Solicitar feature](https://github.com/irvingpoot/RegistroLab/issues)

</div>

---

## 📖 Descripción

**RegistroLab Desktop** es la versión de escritorio del Sistema de Gestión Lab-Somno, construida con **Electron** + **Astro**. Empaqueta la interfaz web en una aplicación nativa para Windows, permitiendo su uso sin necesidad de un navegador y con acceso directo desde el escritorio.

> Esta versión comparte el mismo stack frontend que la [versión web](https://github.com/irvingpoot/RegistroLab), pero corre localmente como app instalable gracias a Electron.

---

## ✨ Características

- 🖥️ **App nativa para Windows** empaquetada con Electron Builder
- ⚡ **Interfaz web embebida** con Astro para máximo rendimiento
- 🗄️ **Base de datos en la nube** conectada a Supabase (PostgreSQL)
- 🎨 **UI moderna y responsiva** con TailwindCSS
- 📦 **Instalador NSIS** con acceso directo en escritorio
- 🔧 **Modo desarrollo** con hot-reload simultáneo (Astro + Electron)

---

## 🛠️ Stack tecnológico

| Tecnología | Uso |
|---|---|
| [Electron](https://www.electronjs.org/) | Empaquetado como app de escritorio |
| [Astro](https://astro.build/) | Framework principal de frontend |
| [TailwindCSS](https://tailwindcss.com/) | Estilos utilitarios y diseño |
| [Supabase](https://supabase.com/) | Base de datos y backend (PostgreSQL) |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático |
| [pnpm](https://pnpm.io/) | Gestor de paquetes |
| [electron-builder](https://www.electron.build/) | Generación del instalador `.exe` |

---

## 🚀 Inicio rápido

### Prerrequisitos

- **Node.js** `>= 18`
- **pnpm** instalado globalmente

```bash
npm install -g pnpm

node node_modules/electron/install.js
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/irvingpoot/RegistroLab-Desktop.git
cd RegistroLab-Desktop

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
```

### Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las claves de Supabase (obtenidas desde el [dashboard de Supabase](https://supabase.com/dashboard)):

```env
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 📜 Scripts disponibles

```bash
# Desarrollo web (solo Astro, en el navegador)
pnpm dev

# Desarrollo desktop (Astro + Electron con hot-reload)
pnpm electron:dev

# Vista previa del build web
pnpm preview

# Compilar la app (Astro build + Electron)
pnpm electron:build

# Generar instalador .exe para distribución
pnpm dist
```

> 💡 Para desarrollo activo de la app de escritorio, usa siempre `pnpm electron:dev`.

---

## 📦 Generar instalador

Para distribuir la aplicación como instalador `.exe`:

```bash
pnpm dist
```

El instalador se generará en la carpeta `release/`. Configuración del build:

- **AppId:** `com.labsomno.app`
- **Nombre:** `Lab Somno Desktop`
- **Target:** NSIS (instalador con asistente)
- **Acceso directo:** Se crea automáticamente en el escritorio

---

## 📂 Estructura del proyecto

```
RegistroLab-Desktop/
├── public/                 # Archivos estáticos
├── src/
│   ├── assets/             # Recursos (imágenes, íconos, fuentes)
│   ├── components/         # Componentes reutilizables de UI
│   ├── layouts/            # Plantillas base de las páginas
│   └── pages/              # Rutas y páginas del sitio
├── electron-main.cjs       # Proceso principal de Electron
├── .env                    # Variables de entorno (no commitear)
├── astro.config.mjs        # Configuración de Astro
├── tailwind.config.js      # Configuración de TailwindCSS
├── tsconfig.json           # Configuración de TypeScript
└── package.json            # Dependencias y scripts
```

---

## 🔗 Versiones del proyecto

| Versión | Repositorio | Descripción |
|---|---|---|
| 🌐 Web | [RegistroLab](https://github.com/irvingpoot/RegistroLab) | Desplegada en Vercel |
| 🖥️ Desktop | Este repositorio | App instalable para Windows |

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Si tienes ideas o encuentras algún bug:

1. Haz **fork** del repositorio
2. Crea una rama: `git checkout -b feature/mi-nueva-feature`
3. Commitea tus cambios: `git commit -m 'feat: agrega nueva feature'`
4. Haz push: `git push origin feature/mi-nueva-feature`
5. Abre un **Pull Request**

---

## 👤 Autor

**Irving Poot**

[![GitHub](https://img.shields.io/badge/GitHub-@irvingpoot-181717?style=flat-square&logo=github)](https://github.com/irvingpoot)

---

<div align="center">
  <sub>Hecho con ❤️ usando Astro + Electron + TailwindCSS + Supabase</sub>
</div>
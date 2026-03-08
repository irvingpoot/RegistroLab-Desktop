# 📘 RegistroLab - Desktop Version

**RegistroLab** es una aplicación web diseñada para la **gestión de usuarios y registros**, construida con tecnologías modernas como [Astro](https://astro.build/), [TailwindCSS](https://tailwindcss.com/) y [Clerk](https://clerk.com/). Su objetivo es ofrecer una base sólida para proyectos que requieran autenticación, diseño adaptable y despliegue eficiente.

---

## 🚀 Tecnologías principales

<div align="center">
  <img src="https://astro.build/assets/press/astro-icon-light.png" alt="Astro" width="60"/>&nbsp;&nbsp;
  <img src="https://cdn.worldvectorlogo.com/logos/tailwindcss.svg" alt="TailwindCSS" width="60"/>&nbsp;&nbsp;
  <img src="https://avatars.githubusercontent.com/u/63343630?s=200&v=4" alt="Clerk" width="60"/>
</div>

- **[Astro](https://astro.build/):** Framework de frontend rápido y flexible.
- **[TailwindCSS](https://tailwindcss.com/):** Sistema de estilos utilitarios para interfaces modernas.
- **[Clerk](https://clerk.com/):** Autenticación y gestión de usuarios.
- **[Node.js](https://nodejs.org/):** Entorno de ejecución para JavaScript.
- **[pnpm](https://pnpm.io/):** Gestor de paquetes ligero y eficiente.

---

## 📦 Instalación y configuración

1. **Clonar el repositorio**:
   ```sh
   git clone <url-del-repo>
   cd RegistroLab
   ```

2. **Instalar dependencias**:
   ```sh
   pnpm install
   ```

3. **Configurar variables de entorno**:
   Crear un archivo `.env` en la raíz del proyecto con las claves de Clerk:
   ```env
   PUBLIC_CLERK_PUBLISHABLE_KEY=tu_publishable_key
   CLERK_SECRET_KEY=tu_secret_key
   ```

---

## 🛠️ Scripts disponibles
Estos son los comandos definidos en `package.json`:

- `pnpm dev` → Inicia el servidor de desarrollo.
- `pnpm build` → Genera la compilación para producción.
- `pnpm preview` → Ejecuta una vista previa de la compilación.
- `pnpm astro` → Acceso directo a scripts de Astro.

---

## 📂 Estructura del proyecto

```sh
/
├── public/          # Archivos estáticos
├── src/
│   ├── assets/      # Recursos (imágenes, íconos, etc.)
│   ├── components/  # Componentes reutilizables
│   ├── layouts/     # Plantillas de diseño
│   └── pages/       # Páginas del sitio
├── .env             # Variables de entorno
├── package.json     # Dependencias y scripts
├── astro.config.mjs # Configuración de Astro
├── tailwind.config.js # Configuración de TailwindCSS
└── tsconfig.json    # Configuración de TypeScript
```

---

## 📌 Notas adicionales
- Asegúrate de tener instalado **Node.js** (versión recomendada ≥ 18).
- Se recomienda usar **pnpm** para mayor compatibilidad con el proyecto.
- Clerk requiere claves válidas para funcionar correctamente.

---


# Technology Stack

## Frontend Framework
- **React 18.3.1** with TypeScript
- **Vite 5.4.19** as build tool and dev server
- **React Router DOM 6.30.1** for routing

## UI Framework & Styling
- **shadcn/ui** component library (Radix UI primitives)
- **Tailwind CSS 3.4.17** for styling
- **Framer Motion 12.34.3** for animations
- **Lucide React 0.462.0** for icons
- **next-themes 0.3.0** for theme management (light/dark mode)

## State Management & Data Fetching
- **TanStack Query 5.83.0** (@tanstack/react-query) for server state
- **React Hook Form 7.61.1** with Zod 3.25.76 for form validation
- **@hookform/resolvers 3.10.0** for validation integration

## Backend & Database
- **Supabase** (@supabase/supabase-js 2.88.0)
  - PostgreSQL database with Row Level Security (RLS)
  - Edge Functions for serverless compute
  - Real-time subscriptions
  - Authentication and authorization
  - Storage for file uploads

## Key Libraries
- **date-fns 3.6.0** - Date manipulation
- **recharts 2.15.4** - Data visualization
- **@hello-pangea/dnd 18.0.1** - Drag and drop
- **jspdf 3.0.4** + **jspdf-autotable 5.0.7** - PDF generation
- **xlsx 0.18.5** - Excel export
- **docx 9.5.3** - Word document generation
- **pdfjs-dist 5.4.624** - PDF viewing
- **tesseract.js 4.0.2** - OCR for document extraction
- **sonner 1.7.4** - Toast notifications

## Development Tools
- **TypeScript 5.8.3**
- **ESLint 9.32.0** with typescript-eslint
- **PostCSS 8.5.6** with Autoprefixer
- **@vitejs/plugin-react-swc 3.11.0** - Fast refresh with SWC

## Common Commands

### Development
```bash
npm run dev              # Start dev server (http://localhost:5173)
```

### Building
```bash
npm run build            # Production build (outputs to dist/)
npm run build:dev        # Development mode build
npm run preview          # Preview production build locally
```

### Code Quality
```bash
npm run lint             # Run ESLint on all TypeScript files
```

### Installation
```bash
npm install              # Install all dependencies
```

## Build Configuration

### Vite Config
- SWC for fast React refresh
- Path aliases configured via `@/` pointing to `src/`
- Environment variables via `.env` file (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)

### TypeScript Config
- Strict mode enabled
- Path mapping: `@/*` → `./src/*`
- Target: ES2020
- Module: ESNext

### Tailwind Config
- Custom color system based on CSS variables
- Extended animations (fade-in, slide-in, stagger, shimmer, float)
- Custom fonts: Poppins (body), Montserrat (headings), Inter (fallback)
- Custom utilities: gradient-primary, glass-morphism, hover-lift, text-glow

## Environment Setup
Required environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

## Browser Support
- Modern browsers with ES2020 support
- Chrome, Firefox, Safari, Edge (latest versions)

# Tassos ERP System

## Overview

This is a comprehensive Enterprise Resource Planning (ERP) system built for Tassos Consultancy Services. The application provides modules for Human Resource Management (HRMS), Customer Relationship Management (CRM), Inventory Management, Sales, Purchases, Accounting, Logistics, and User Administration. It's designed as a cloud-based SaaS solution targeting government IT solutions and enterprise clients.

## Recent Changes

**December 23, 2025**: Successfully migrated from Supabase to PostgreSQL
- Converted entire project from mockup/prototype to fully functional application
- Implemented PostgreSQL database with Drizzle ORM
- Created comprehensive backend with Express API routes for all modules
- Added database schema with 25+ tables covering all ERP modules
- Implemented storage layer with type-safe CRUD operations
- Created React Query hooks for efficient data fetching
- Seeded database with sample data for testing
- All API endpoints tested and working correctly

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: React Context API for auth state, TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom enterprise blue/yellow theme
- **Charts**: Recharts for data visualization
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express
- **API Design**: RESTful API endpoints under `/api/*`
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod for type-safe schemas

### Data Storage
- **Primary Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **ORM**: Drizzle ORM for type-safe database queries
- **Schema Location**: `shared/schema.ts` contains all table definitions

### Authentication
- **Current**: Local authentication system with PostgreSQL backend
- **Client-side Auth State**: React Context with persistent session management
- **Note**: Previously used Supabase, now fully migrated to PostgreSQL-based authentication

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route-based page components
│   ├── lib/             # Utilities, API client, store
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database operations interface
│   └── db.ts            # Database connection
├── shared/              # Shared code between client/server
│   └── schema.ts        # Drizzle database schema
└── migrations/          # Database migrations
```

### Key Design Patterns
- **Storage Interface Pattern**: `server/storage.ts` defines a typed interface for all database operations, making it easy to swap implementations
- **API Hook Pattern**: Custom hooks in `client/src/hooks/useApi.ts` wrap React Query for consistent data fetching
- **Component Composition**: UI built from shadcn/ui primitives composed into feature-specific components

### Module Organization
Each ERP module (HRMS, CRM, Inventory, etc.) has its own page component with:
- Local state management for forms and dialogs
- API integration via custom hooks
- Consistent UI patterns using shared components

## External Dependencies

### Database
- **PostgreSQL**: Primary relational database
- **Drizzle Kit**: Database migration and schema push tool
- **Connection**: Via `DATABASE_URL` environment variable

### Data Fetching & API Integration
- **API Client**: Custom fetch wrapper in `client/src/lib/api.ts`
- **React Query Hooks**: Comprehensive hooks in `client/src/hooks/useApi.ts` for all modules
- **Features**: Automatic cache invalidation, optimistic updates, error handling

### UI Libraries
- **Radix UI**: Headless accessible components (dialogs, dropdowns, tabs, etc.)
- **Recharts**: React charting library for dashboards
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Full type coverage across frontend and backend

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Replit integration tooling
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileQuestion, ArrowLeft, LayoutDashboard, Search } from "lucide-react";

/**
 * ============================================================================
 * PREMIUM 404 NOT FOUND PAGE
 * ============================================================================
 * 
 * PURPOSE: Provides a high-end, brand-consistent "escape" page when a user
 * navigates to a non-existent route.
 * 
 * DESIGN AESTHETICS:
 * - Centered, modern layout with subtle background gradients
 * - Clear branding (TCS Logo)
 * - Action-oriented buttons for navigation
 * - Responsive and visually engaging
 * 
 * ============================================================================
 */
export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] overflow-hidden relative">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-100/40 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[300px] h-[300px] bg-indigo-100/30 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-2xl px-6 text-center animate-in fade-in zoom-in duration-500">
        

        {/* Hero Section */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl border border-slate-100 mb-6 text-blue-600">
            <FileQuestion className="w-12 h-12 stroke-[1.5]" />
          </div>
          <h1 className="text-6xl font-extrabold text-[#0f172a] tracking-tight mb-4">
            404
          </h1>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Page Not Found
          </h2>
          <p className="text-slate-500 max-w-md mx-auto text-lg leading-relaxed">
            Oops! The page you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <Link href="/">
            <Button size="lg" className="h-12 px-8 gap-2 bg-[#1d4ed8] hover:bg-[#1e40af] text-white shadow-lg shadow-blue-600/20 rounded-xl transition-all hover:scale-105 active:scale-95">
              <LayoutDashboard className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="h-12 px-8 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4" />
            Previous Page
          </Button>
        </div>

        {/* Footer Help */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <p className="text-slate-400 text-sm">
            If you believe this is a technical error, please contact your administrator.
          </p>
        </div>
      </div>

      {/* Modern Background Accents (SVG patterns) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
        <svg width="100%" height="100%">
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
    </div>
  );
}

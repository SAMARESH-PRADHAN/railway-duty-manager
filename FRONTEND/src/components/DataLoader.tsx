// src/components/DataLoader.tsx
import { useData } from "@/context/DataContext";
import { Loader2 } from "lucide-react";

export function DataLoader({ children }: { children: React.ReactNode }) {
  const { loading, error, refresh } = useData();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0b2545] mx-auto" />
          <p className="mt-2 text-sm text-slate-500">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 max-w-md">
          <p className="text-rose-600 font-semibold">Failed to load data</p>
          <p className="text-sm text-slate-600 mt-1">{error}</p>
          <button 
            onClick={refresh}
            className="mt-4 px-4 py-2 bg-[#0b2545] text-white rounded hover:bg-[#0b2545]/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return children;
}
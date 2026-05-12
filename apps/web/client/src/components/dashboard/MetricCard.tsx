import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({ label, value, currency, subLabel, icon: Icon, iconBg, loading }: {
  label: string; value: any; currency?: string; subLabel?: string;
  icon: any; iconBg: string; loading?: boolean;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.04] p-5 hover:shadow-md transition-shadow"
      style={{ backgroundImage: `url('https://raw.githubusercontent.com/Lento47/pymeshub-invoice/refs/heads/master/statusBackground.png')`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-[#0c0c0e]/[0.88] rounded-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm font-medium text-white/70">{label}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        {loading ? <Skeleton className="h-7 w-20" /> : (
          <>
            <p className="text-2xl font-bold text-white/90">
              {currency}{typeof value === "number" ? value.toLocaleString("es-ES") : value}
            </p>
            {subLabel && <p className="text-xs text-white/50 mt-1">{subLabel}</p>}
          </>
        )}
      </div>
    </div>
  );
}

interface Feature {
  feature: string;
  starter: string;
  growth: string;
  business: string;
  enterprise: string;
}

interface FeatureComparisonProps {
  features: Feature[];
}

export function FeatureComparison({ features }: FeatureComparisonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-sm font-semibold text-foreground">Feature</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Starter</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-primary">Growth ⭐</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">Business</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
              Enterprise
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((row, index) => (
            <tr
              key={index}
              className={`border-b border-border ${
                index % 2 === 0 ? 'bg-card' : 'bg-muted'
              }`}
            >
              <td className="px-4 py-3 text-sm font-medium text-foreground">{row.feature}</td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                {row.starter === '✓' ? <span className="text-success font-bold">✓</span> : row.starter === '—' ? '—' : row.starter}
              </td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-primary">
                {row.growth === '✓' ? <span className="text-success font-bold">✓</span> : row.growth === '—' ? '—' : row.growth}
              </td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                {row.business === '✓' ? <span className="text-success font-bold">✓</span> : row.business === '—' ? '—' : row.business}
              </td>
              <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                {row.enterprise === '✓' ? <span className="text-success font-bold">✓</span> : row.enterprise === '—' ? '—' : row.enterprise}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

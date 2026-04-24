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
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Feature</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Starter</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-blue-600">Growth ⭐</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Business</th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
              Enterprise
            </th>
          </tr>
        </thead>
        <tbody>
          {features.map((row, index) => (
            <tr
              key={index}
              className={`border-b border-gray-200 ${
                index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.feature}</td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">
                {row.starter === '✓' ? <span className="text-green-600 font-bold">✓</span> : row.starter === '—' ? '—' : row.starter}
              </td>
              <td className="px-4 py-3 text-center text-sm font-semibold text-blue-600">
                {row.growth === '✓' ? <span className="text-green-600 font-bold">✓</span> : row.growth === '—' ? '—' : row.growth}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">
                {row.business === '✓' ? <span className="text-green-600 font-bold">✓</span> : row.business === '—' ? '—' : row.business}
              </td>
              <td className="px-4 py-3 text-center text-sm text-gray-600">
                {row.enterprise === '✓' ? <span className="text-green-600 font-bold">✓</span> : row.enterprise === '—' ? '—' : row.enterprise}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { createContext, useContext, useState } from "react";

type MerchantScope = {
	businessId?: string;
	locationId?: string;
	selectBusiness: (businessId: string) => void;
	selectLocation: (businessId: string, locationId: string) => void;
};

const MerchantScopeContext = createContext<MerchantScope | null>(null);

/** The branch chosen by the operator stays visible across merchant tabs. */
export function MerchantScopeProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [scope, setScope] = useState<{
		businessId?: string;
		locationId?: string;
	}>({});
	return (
		<MerchantScopeContext.Provider
			value={{
				...scope,
				selectBusiness: (businessId) => setScope({ businessId }),
				selectLocation: (businessId, locationId) =>
					setScope({ businessId, locationId }),
			}}
		>
			{children}
		</MerchantScopeContext.Provider>
	);
}

export function useMerchantScope(): MerchantScope {
	const scope = useContext(MerchantScopeContext);
	if (!scope) throw new Error("MerchantScopeProvider is missing");
	return scope;
}

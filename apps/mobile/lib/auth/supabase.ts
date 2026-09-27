import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { env } from "@/lib/env";

/**
 * Supabase's browser client for the optional second provider.
 *
 * The publishable key is safe in a phone bundle: it identifies the project and cannot
 * bypass RLS. The secret/service-role key is never imported here and is not an Expo
 * public variable. The client is created only when both public coordinates exist, so a
 * normal Better Auth install does not silently depend on Supabase being configured.
 */
const configured = Boolean(env.supabaseUrl && env.supabasePublishableKey);

const storage = {
	getItem: (key: string) => SecureStore.getItemAsync(key),
	setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
	removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabaseConfigured = configured;
export const supabase: SupabaseClient | null = configured
	? createClient(
			env.supabaseUrl as string,
			env.supabasePublishableKey as string,
			{
				auth: {
					storage,
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false,
				},
			},
		)
	: null;

export function supabaseAvailable(): boolean {
	return configured && supabase !== null && Platform.OS !== "web";
}

export async function supabaseAccessToken(): Promise<string | null> {
	if (!supabase) return null;
	const { data } = await supabase.auth.getSession();
	return data.session?.access_token ?? null;
}

export async function supabaseSignOut(): Promise<void> {
	if (supabase) await supabase.auth.signOut();
}

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  ChevronRight,
  UserRound,
  ShieldCheck,
  SlidersHorizontal,
  KeyRound,
  LogOut,
  Upload,
  Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useDisplayPreferences } from "@/components/providers/display-preferences";
import { ProfileTab } from "@/components/settings/profile-tab";
import { AccountAvatar } from "@/components/account-avatar";
import { DevicePermissions } from "@/components/settings/device-permissions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { hasPermission, Permission } from "@/lib/permissions";
import { api } from "@/lib/api";

export default function AccountPage({ section }: { section?: string }) {
  const { user, logout, refreshUser } = useAuth();
  const { locale, setLocale } = useI18n();
  const es = locale === "es";
  const { theme, toggle } = useTheme();
  const display = useDisplayPreferences();
  const [leaving, setLeaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.uploadAvatar(fd);
      await refreshUser();
      await queryClient.invalidateQueries({
        queryKey: ["account-avatar", user?.id],
      });
    } finally {
      setUploadingPhoto(false);
    }
  }
  const sections = [
    {
      key: "profile",
      icon: UserRound,
      title: es ? "Información personal" : "Personal information",
      description: es
        ? "Tu nombre y foto de perfil"
        : "Your name and profile photo",
    },
    {
      key: "security",
      icon: ShieldCheck,
      title: es ? "Seguridad" : "Security",
      description: es ? "Cambia tu contraseña" : "Change your password",
    },
    {
      key: "preferences",
      icon: SlidersHorizontal,
      title: es ? "A tu manera" : "Make it yours",
      description: es
        ? "Apariencia, lectura y movimiento"
        : "Appearance, reading and motion",
    },
    {
      key: "access",
      icon: KeyRound,
      title: es ? "Permisos y acceso" : "Permissions and access",
      description: es
        ? "Tu rol y los permisos del dispositivo"
        : "Your role and device permissions",
    },
  ];
  const current = sections.find(({ key }) => key === section);

  return (
    <div className="account-page mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {current && (
        <Link
          href="/account"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          {es ? "Mi cuenta" : "Account"}
        </Link>
      )}
      <h1 className="text-3xl font-bold tracking-tight">
        {current?.title ?? (es ? "Mi cuenta" : "Account")}
      </h1>
      {!current ? (
        <>
          <div className="my-5 flex min-w-0 flex-wrap items-center gap-4">
            <AccountAvatar
              className="h-16 w-16 text-xl"
              onPick={() => fileInput.current?.click()}
              pickLabel={es ? "Subir foto de perfil" : "Upload profile photo"}
            />
            <div className="min-w-0 flex-1">
              <p className="break-words text-xl font-semibold">{user?.name}</p>
              <p className="break-all text-sm text-muted-foreground">
                {user?.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 rounded-lg text-xs"
                  disabled={uploadingPhoto}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {es ? "Subir foto" : "Upload photo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 rounded-lg text-xs"
                  disabled={uploadingPhoto}
                  onClick={() => cameraInput.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {es ? "Tomar foto" : "Take picture"}
                </Button>
              </div>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label={es ? "Subir foto de perfil" : "Upload profile photo"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleAvatarFile(file);
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              aria-label={es ? "Tomar foto de perfil" : "Take profile picture"}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                void handleAvatarFile(file);
              }}
            />
          </div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 px-4 py-3">
            <p className="min-w-0 break-words text-sm font-semibold">
              {user?.workspace.name}
            </p>
            <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
              {user?.role}
            </span>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {sections.map(({ key, icon: Icon, title, description }) => (
              <Link
                key={key}
                href={`/account/${key}`}
                className="mobile-tab flex min-h-20 items-center gap-4 border-b border-border p-4 last:border-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <Icon
                  aria-hidden="true"
                  className="h-6 w-6 shrink-0"
                  strokeWidth={1.7}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
                <ChevronRight
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted-foreground"
                />
              </Link>
            ))}
          </div>
          <Link
            href="/help"
            className="mt-5 flex min-h-12 items-center justify-between rounded-xl px-2 text-sm font-medium hover:bg-muted"
          >
            {es ? "Ayuda y soporte" : "Help and support"}
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Button
            variant="outline"
            disabled={leaving}
            className="mt-5 min-h-12 w-full rounded-2xl"
            onClick={async () => {
              setLeaving(true);
              try {
                await logout();
              } finally {
                setLeaving(false);
              }
            }}
          >
            <LogOut aria-hidden="true" />
            {leaving
              ? es
                ? "Cerrando sesión…"
                : "Signing out…"
              : es
                ? "Cerrar sesión"
                : "Sign out"}
          </Button>
        </>
      ) : (
        <div className="mt-6">
          {(section === "profile" || section === "security") && (
            <ProfileTab key={`${user?.id}:${section}`} section={section} />
          )}
          {section === "preferences" && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {es
                  ? "Ajusta cómo se ve y se siente la app en este navegador."
                  : "Adjust how the app looks and feels in this browser."}
              </p>
              <div className="divide-y divide-border rounded-3xl border border-border bg-card px-5">
                {[
                  {
                    id: "light-mode",
                    label: es ? "Modo claro" : "Light mode",
                    detail: es
                      ? "Cambia entre claro y oscuro"
                      : "Switch between light and dark",
                    checked: theme === "light",
                    change: toggle,
                  },
                  {
                    id: "large-text",
                    label: es ? "Texto más grande" : "Larger text",
                    detail: es
                      ? "Más espacio para leer con comodidad"
                      : "More room for comfortable reading",
                    checked: display.largeText,
                    change: (value: boolean) =>
                      display.setPreference("largeText", value),
                  },
                  {
                    id: "reduce-motion",
                    label: es ? "Reducir movimiento" : "Reduce motion",
                    detail: es
                      ? "También respetamos la preferencia de tu sistema"
                      : "We also respect your system preference",
                    checked: display.reducedMotion,
                    change: (value: boolean) =>
                      display.setPreference("reducedMotion", value),
                  },
                ].map(({ id, label, detail, checked, change }) => (
                  <div key={id} className="flex items-center gap-4 py-5">
                    <Label
                      htmlFor={id}
                      className="flex-1 cursor-pointer text-base leading-normal"
                    >
                      {label}
                      <span className="mt-1 block text-sm font-normal text-muted-foreground">
                        {detail}
                      </span>
                    </Label>
                    <Switch
                      id={id}
                      checked={checked}
                      onCheckedChange={change}
                      className="h-7 w-12"
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="account-language">
                  {es ? "Idioma" : "Language"}
                </Label>
                <select
                  id="account-language"
                  className="mt-2 min-h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-foreground"
                  value={locale}
                  onChange={(e) =>
                    setLocale(e.target.value === "en" ? "en" : "es")
                  }
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                {es
                  ? "La lectura y el movimiento se guardan para tu cuenta y espacio en este navegador. Si el almacenamiento está bloqueado, duran esta sesión."
                  : "Reading and motion are saved for your account and workspace in this browser. With storage blocked, they last for this session."}
              </p>
            </div>
          )}
          {section === "access" && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-muted/60 p-5">
                <h2 className="font-semibold">
                  {es ? "Tu rol" : "Your role"}: {user?.role}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {es
                    ? "Los permisos los administra tu espacio de trabajo. Personalizar la app no cambia tu acceso."
                    : "Your workspace manages permissions. Customizing the app does not change your access."}
                </p>
              </div>
              <ul className="divide-y divide-border rounded-2xl border border-border px-5">
                {[
                  [
                    Permission.CONVERSATIONS_REPLY,
                    es ? "Responder conversaciones" : "Reply to conversations",
                  ],
                  [
                    Permission.TASKS_MANAGE,
                    es ? "Gestionar tareas" : "Manage tasks",
                  ],
                  [
                    Permission.INVOICES_MANAGE,
                    es ? "Gestionar facturas" : "Manage invoices",
                  ],
                  [
                    Permission.MEMBERS_MANAGE,
                    es ? "Administrar miembros" : "Manage members",
                  ],
                ].map(([permission, title]) => (
                  <li
                    key={permission}
                    className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm"
                  >
                    <span>{title}</span>
                    <span className="font-semibold">
                      {hasPermission(
                        user?.role ?? "",
                        permission as Permission,
                        !!user?.is_platform_admin,
                      )
                        ? es
                          ? "Permitido"
                          : "Allowed"
                        : es
                          ? "Sin acceso"
                          : "No access"}
                    </span>
                  </li>
                ))}
              </ul>
              <DevicePermissions />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

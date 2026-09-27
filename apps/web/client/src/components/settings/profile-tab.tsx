import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, EyeOff, Loader2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountAvatar } from "@/components/account-avatar";

export function ProfileTab({
  section = "profile",
}: {
  section?: "profile" | "security";
}) {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { locale } = useI18n();
  const es = locale === "es";
  const [name, setName] = useState(user?.name ?? "");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [visible, setVisible] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);

  const dirty =
    name.trim() !== user?.name || !!currentPass || !!newPass || !!confirmPass;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updateName = useMutation({
    mutationFn: () => api.updateMe({ name: name.trim() }),
    onSuccess: async () => {
      setName(name.trim());
      await refreshUser();
    },
  });
  const changePass = useMutation({
    mutationFn: () =>
      api.changePassword({
        current_password: currentPass,
        new_password: newPass,
      }),
    onSuccess: () => {
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
    },
  });
  const uploadAv = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.uploadAvatar(fd);
    },
    onSuccess: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({
        queryKey: ["account-avatar", user?.id],
      });
    },
  });

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const mismatch = newPass !== confirmPass;
    confirmInput.current?.setCustomValidity(
      mismatch
        ? es
          ? "Las contraseñas no coinciden."
          : "Passwords do not match."
        : "",
    );
    if (mismatch) {
      confirmInput.current?.reportValidity();
      return;
    }
    changePass.mutate();
  }
  const fieldClass = "mt-2 min-h-12 rounded-xl border-border bg-card text-base";
  function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    uploadAv.reset();
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setFileError(
        es
          ? "Elige una imagen JPEG, PNG o WebP de hasta 2 MB."
          : "Choose a JPEG, PNG or WebP image up to 2 MB.",
      );
      return;
    }
    setFileError("");
    uploadAv.mutate(file);
  }
  const error = section === "profile" ? updateName.error : changePass.error;
  const success =
    section === "profile" ? updateName.isSuccess : changePass.isSuccess;

  return (
    <div className="space-y-6">
      {section === "profile" ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-muted/60 p-5">
            <AccountAvatar
              className="h-20 w-20 text-2xl"
              showError
              onPick={() => fileInput.current?.click()}
              pickLabel={es ? "Subir foto de perfil" : "Upload profile photo"}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 rounded-xl"
                  disabled={uploadAv.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploadAv.isPending ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Upload aria-hidden="true" />
                  )}
                  {uploadAv.isPending
                    ? es
                      ? "Subiendo…"
                      : "Uploading…"
                    : es
                      ? "Subir foto"
                      : "Upload photo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 rounded-xl"
                  disabled={uploadAv.isPending}
                  onClick={() => cameraInput.current?.click()}
                >
                  <Camera aria-hidden="true" />
                  {es ? "Tomar foto" : "Take picture"}
                </Button>
              </div>
              <p
                id="avatar-help"
                className="mt-2 text-sm text-muted-foreground"
              >
                JPEG, PNG, WebP · {es ? "Máximo 2 MB" : "Up to 2 MB"}
              </p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-label={es ? "Subir foto de perfil" : "Upload profile photo"}
              aria-describedby="avatar-help"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleAvatarFile(file);
              }}
            />
            <input
              ref={cameraInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              aria-label={es ? "Tomar foto de perfil" : "Take profile picture"}
              aria-describedby="avatar-help"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                handleAvatarFile(file);
              }}
            />
          </div>
          {(fileError || uploadAv.error) && (
            <p role="alert" className="text-sm text-destructive">
              {fileError || uploadAv.error?.message}
            </p>
          )}
          {uploadAv.isSuccess && (
            <p role="status" className="text-sm">
              {es ? "Foto actualizada." : "Photo updated."}
            </p>
          )}
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem(
                "name",
              ) as HTMLInputElement;
              input.setCustomValidity(
                name.trim().length < 2
                  ? es
                    ? "Escribe al menos 2 caracteres."
                    : "Enter at least 2 characters."
                  : "",
              );
              if (input.reportValidity()) updateName.mutate();
            }}
          >
            <div>
              <Label htmlFor="profile-name">{es ? "Nombre" : "Name"}</Label>
              <Input
                id="profile-name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                disabled={updateName.isPending}
                onChange={(e) => {
                  e.target.setCustomValidity("");
                  updateName.reset();
                  setName(e.target.value);
                }}
                className={fieldClass}
              />
            </div>
            <div>
              <Label htmlFor="profile-email">
                {es ? "Correo de la cuenta" : "Account email"}
              </Label>
              <Input
                id="profile-email"
                type="email"
                name="email"
                autoComplete="email"
                value={user?.email ?? ""}
                readOnly
                className={fieldClass}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                {es
                  ? "Este es el correo con el que accedes a tu cuenta."
                  : "This is the email you use to sign in."}
              </p>
            </div>
            <Button
              type="submit"
              disabled={updateName.isPending || name.trim() === user?.name}
              className="min-h-12 w-full rounded-2xl"
            >
              {updateName.isPending && (
                <Loader2 aria-hidden="true" className="animate-spin" />
              )}
              {updateName.isPending
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : es
                  ? "Guardar nombre"
                  : "Save name"}
            </Button>
          </form>
        </>
      ) : (
        <form onSubmit={submitPassword} className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {es
              ? "Confirma tu contraseña actual para elegir una nueva."
              : "Confirm your current password to choose a new one."}
          </p>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={user?.email ?? ""}
            readOnly
            hidden
          />
          {[
            {
              id: "current-password",
              label: es ? "Contraseña actual" : "Current password",
              value: currentPass,
              set: setCurrentPass,
              auto: "current-password",
            },
            {
              id: "new-password",
              label: es ? "Nueva contraseña" : "New password",
              value: newPass,
              set: setNewPass,
              auto: "new-password",
            },
            {
              id: "confirm-password",
              label: es ? "Repite la nueva contraseña" : "Repeat new password",
              value: confirmPass,
              set: setConfirmPass,
              auto: "new-password",
            },
          ].map(({ id, label, value, set, auto }) => (
            <div key={id}>
              <Label htmlFor={id}>{label}</Label>
              <Input
                ref={id === "confirm-password" ? confirmInput : undefined}
                id={id}
                name={id}
                type={visible ? "text" : "password"}
                autoComplete={auto}
                required
                minLength={id === "current-password" ? undefined : 8}
                value={value}
                disabled={changePass.isPending}
                aria-describedby={
                  id === "new-password" ? "password-help" : undefined
                }
                onChange={(e) => {
                  confirmInput.current?.setCustomValidity("");
                  changePass.reset();
                  set(e.target.value);
                }}
                className={fieldClass}
              />
              {id === "new-password" && (
                <p
                  id="password-help"
                  className="mt-2 text-sm text-muted-foreground"
                >
                  {es
                    ? "Usa al menos 8 caracteres."
                    : "Use at least 8 characters."}
                </p>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
            className="min-h-11 rounded-xl"
          >
            {visible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
            {es
              ? visible
                ? "Ocultar contraseñas"
                : "Mostrar contraseñas"
              : visible
                ? "Hide passwords"
                : "Show passwords"}
          </Button>
          <Button
            type="submit"
            disabled={changePass.isPending}
            className="min-h-12 w-full rounded-2xl"
          >
            {changePass.isPending && (
              <Loader2 aria-hidden="true" className="animate-spin" />
            )}
            {changePass.isPending
              ? es
                ? "Actualizando…"
                : "Updating…"
              : es
                ? "Actualizar contraseña"
                : "Update password"}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm font-medium">
          {section === "profile"
            ? es
              ? "Nombre actualizado."
              : "Name updated."
            : es
              ? "Contraseña actualizada."
              : "Password updated."}
        </p>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { User, Phone, Mail } from "lucide-react";
import { SensitiveText } from "@/components/shared/sensitive-text";

interface ContactAttachmentProps {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  className?: string;
}

export function ContactAttachment({ displayName, phone, email, className }: ContactAttachmentProps) {
  return (
    <div className={cn("flex min-w-[230px] max-w-[340px] flex-col gap-2 rounded-xl border border-border/55 bg-card/80 px-3 py-2.5 shadow-sm", className)}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
          <User className="h-4 w-4" />
        </div>
        <span className="min-w-0 truncate text-sm font-medium">
          <SensitiveText text={displayName ?? "Contacto"} />
        </span>
      </div>
      {phone && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Phone className="h-3 w-3" />
          <a href={`tel:${phone}`} className="hover:text-foreground">
            <SensitiveText text={phone} />
          </a>
        </div>
      )}
      {email && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Mail className="h-3 w-3" />
          <a href={`mailto:${email}`} className="hover:text-foreground">
            <SensitiveText text={email} />
          </a>
        </div>
      )}
    </div>
  );
}

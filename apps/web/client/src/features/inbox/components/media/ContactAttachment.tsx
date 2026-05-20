import { cn } from "@/lib/utils";
import { User, Phone, Mail } from "lucide-react";

interface ContactAttachmentProps {
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  className?: string;
}

export function ContactAttachment({ displayName, phone, email, className }: ContactAttachmentProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5", className)}>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium">{displayName ?? "Contacto"}</span>
      </div>
      {phone && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Phone className="h-3 w-3" />
          <a href={`tel:${phone}`} className="hover:text-foreground">
            {phone}
          </a>
        </div>
      )}
      {email && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Mail className="h-3 w-3" />
          <a href={`mailto:${email}`} className="hover:text-foreground">
            {email}
          </a>
        </div>
      )}
    </div>
  );
}

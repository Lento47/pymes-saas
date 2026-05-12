import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { openExternal } from "@/lib/platform";
import { useI18n } from "@/components/providers/i18n-provider";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { SUPPORTED_LOCALES, normalizeLocale, type SupportedLocale } from "@/lib/i18n";
import {
  Building2, Users, PlugZap, UserPlus, Plus, Plug,
  Mail, MessageCircle, Radio, Eye, EyeOff, ExternalLink,
  PowerOff, Trash2, Layers, UserMinus, ShieldCheck, Search, BrainCircuit, CheckCircle2, AlertTriangle, BookOpen, CreditCard, Shuffle, Loader2, Key, Copy, Shield,
} from "lucide-react";
import BillingPage from "@/pages/billing";
import { SamlConfig } from "@/components/settings/saml-config";
import { SecretInput } from "@/components/settings/secret-input";
import { DeleteChannelDialog } from "@/components/settings/delete-channel-dialog";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { EmailConfigModal } from "@/components/settings/email-config-modal";
import { WhatsAppConfigModal } from "@/components/settings/whatsapp-config-modal";
import { MembersTab } from "@/components/settings/members-tab";
import { RoutingRulesTab } from "@/components/settings/routing-rules-tab";
import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { AiTab } from "@/components/settings/ai-tab";
import { ApiTokensTab } from "@/components/settings/api-tokens-tab";
import { ChannelsTab } from "@/components/settings/channels-tab";
import { DepartmentsTab } from "@/components/settings/departments-tab";
import { PlatformTab } from "@/components/settings/platform-tab";
import { WorkspaceTab } from "@/components/settings/workspace-tab";
import { ROLE_COLORS, CHANNEL_TYPE_COLORS, CHANNEL_ICONS } from "@/components/settings/settings-constants";
import { ModuleHero } from "@/components/shared/module-hero";

// ═══════════════════════════════════════════════════════════════════════════════

export default function Settings() {
  const { user } = useAuth();
  const { messages } = useI18n();
  const copy = messages.settings;
  const isPlatformAdmin = user?.is_platform_admin === true;

  return (
    <div className="p-6 space-y-6">
      <ModuleHero module="settings">
        <div className="px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{copy.pageTitle}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestiona tu workspace, equipo e integraciones</p>
          </div>
        </div>
      </ModuleHero>
      <Tabs defaultValue="workspace">
        <TabsList className="bg-card border border-border overflow-x-auto flex-nowrap scrollbar-none">
          <TabsTrigger value="workspace" className="data-[state=active]:bg-elevated">
            <Building2 className="h-4 w-4 mr-2" />{copy.tabs.workspace}
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-elevated">
            <Users className="h-4 w-4 mr-2" />{copy.tabs.members}
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-elevated">
            <PlugZap className="h-4 w-4 mr-2" />{copy.tabs.channels}
          </TabsTrigger>
          <TabsTrigger value="departments" className="data-[state=active]:bg-elevated">
            <Layers className="h-4 w-4 mr-2" />{copy.tabs.departments}
          </TabsTrigger>
          <TabsTrigger value="integrations" className="data-[state=active]:bg-elevated">
            <Plug className="h-4 w-4 mr-2" />{copy.tabs.integrations}
          </TabsTrigger>
          <TabsTrigger value="ai" className="data-[state=active]:bg-elevated">
            <BrainCircuit className="h-4 w-4 mr-2" />{copy.tabs.ai}
          </TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-elevated">
            <CreditCard className="h-4 w-4 mr-2" />{copy.tabs.billing}
          </TabsTrigger>
          <TabsTrigger value="routing" className="data-[state=active]:bg-elevated">
            <Shuffle className="h-4 w-4 mr-2" />{copy.tabs.routing}
          </TabsTrigger>
          <TabsTrigger value="apitokens" className="data-[state=active]:bg-elevated">
            <Key className="h-4 w-4 mr-2" />{copy.tabs.apiTokens}
          </TabsTrigger>
          <TabsTrigger value="saml" className="data-[state=active]:bg-elevated">
            <Shield className="h-4 w-4 mr-2" />SAML SSO
          </TabsTrigger>
          {isPlatformAdmin && (
            <TabsTrigger value="platform" className="data-[state=active]:bg-elevated">
              <ShieldCheck className="h-4 w-4 mr-2" />{copy.tabs.platform}
            </TabsTrigger>
          )}
        </TabsList>
        <Card className="mt-4 bg-card border-border">
          <CardContent className="pt-6">
            <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
            <TabsContent value="members"><MembersTab /></TabsContent>
            <TabsContent value="channels"><ChannelsTab /></TabsContent>
            <TabsContent value="departments"><DepartmentsTab /></TabsContent>
            <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
            <TabsContent value="ai"><AiTab /></TabsContent>
            <TabsContent value="billing"><BillingPage /></TabsContent>
            <TabsContent value="routing"><RoutingRulesTab /></TabsContent>
            <TabsContent value="apitokens"><ApiTokensTab /></TabsContent>
            <TabsContent value="saml"><SamlConfig /></TabsContent>
            {isPlatformAdmin && (
              <TabsContent value="platform"><PlatformTab /></TabsContent>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

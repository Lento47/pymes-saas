import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Upload, Search, Loader2, MoreHorizontal, Trash } from "lucide-react";
import { format } from "date-fns";

const STATUS_OPTIONS = ["ALL", "UPLOADED", "PROCESSING", "PROCESSED", "FAILED"];

export default function DocumentsPage() {
  useRequireAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (statusFilter !== "ALL") params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/documents", statusFilter, search],
    queryFn: () => api.getDocuments(Object.keys(params).length ? params : undefined),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document uploaded" });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete document", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = "";
    }
  };

  const docList = Array.isArray(data) ? data : data?.data || [];

  return (
    <div>
      <PageHeader title="Documents" description="Upload and manage documents">
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          data-testid="button-upload-document"
        >
          {uploadMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5 mr-1.5" />
          )}
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
          onChange={handleFileChange}
          data-testid="input-file-upload"
        />
      </PageHeader>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-card border-border"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border" data-testid="select-doc-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All Status" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : docList.length === 0 ? (
        <EmptyState icon={FileText} title="No documents" description="Upload your first document to get started." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground font-medium">Filename</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Type</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Uploaded By</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium">Date</TableHead>
                <TableHead className="text-[11px] text-muted-foreground font-medium w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docList.map((doc: any) => (
                <TableRow key={doc.id} className="border-border hover:bg-white/[0.02]" data-testid={`doc-row-${doc.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{doc.filename || doc.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{doc.mimeType || doc.mime_type || "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={doc.status} type="document" />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {doc.uploadedBy?.firstName || doc.uploaded_by?.firstName || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {doc.createdAt || doc.created_at
                      ? format(new Date(doc.createdAt || doc.created_at), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-document-options-${doc.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(doc.id)}>
                          <Trash className="w-4 h-4 mr-2" />
                          Delete Document
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { getSession } from '../../lib/auth';
import { trpc } from '../../lib/trpc';
import { canEdit } from '../../lib/utils';

type Revision = {
  id: string;
  revisionNumber: number;
  status: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  createdAt: string | Date;
};

async function fetchRevisionBlob(revisionId: string): Promise<Blob> {
  const session = getSession();
  const res = await fetch(`/api/documents/revisions/${revisionId}/download`, {
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  if (!res.ok) {
    throw new Error('Download failed');
  }
  return res.blob();
}

export function DocumentsPage() {
  const session = getSession();
  const editable = canEdit(session?.roles ?? []);

  const [productId, setProductId] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', docType: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRevisionId, setPreviewRevisionId] = useState<string | null>(
    null,
  );
  const [actionError, setActionError] = useState('');

  const productsQuery = trpc.product.list.useQuery({});
  const documentsQuery = trpc.document.listByProduct.useQuery(
    { productId, search: search || undefined },
    { enabled: Boolean(productId) },
  );
  const documentQuery = trpc.document.get.useQuery(
    { documentId: selectedDocumentId ?? '' },
    { enabled: Boolean(selectedDocumentId) },
  );
  const revisionsQuery = trpc.document.revisions.useQuery(
    { documentId: selectedDocumentId ?? '' },
    { enabled: Boolean(selectedDocumentId) },
  );

  const utils = trpc.useUtils();
  const createMutation = trpc.document.create.useMutation({
    onSuccess: (doc) => {
      utils.document.listByProduct.invalidate({ productId });
      setShowCreate(false);
      setCreateForm({ name: '', docType: '' });
      setSelectedDocumentId(doc.id);
    },
  });
  const transitionMutation = trpc.document.transition.useMutation({
    onSuccess: () => {
      if (selectedDocumentId) {
        utils.document.get.invalidate({ documentId: selectedDocumentId });
        utils.document.revisions.invalidate({ documentId: selectedDocumentId });
        utils.document.listByProduct.invalidate({ productId });
      }
    },
  });

  useEffect(() => {
    if (!productsQuery.data?.items.length) return;
    if (!productId) {
      setProductId(productsQuery.data.items[0].id);
    }
  }, [productsQuery.data, productId]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectedRevision = useMemo(() => {
    const revisions = revisionsQuery.data ?? [];
    if (previewRevisionId) {
      return revisions.find((r) => r.id === previewRevisionId) ?? null;
    }
    return revisions[0] ?? null;
  }, [revisionsQuery.data, previewRevisionId]);

  async function handlePreview(revision: Revision) {
    setActionError('');
    try {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const blob = await fetchRevisionBlob(revision.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewRevisionId(revision.id);
    } catch {
      setActionError('Unable to preview this revision (file may not exist in storage).');
    }
  }

  async function handleDownload(revision: Revision) {
    setActionError('');
    try {
      const blob = await fetchRevisionBlob(revision.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = revision.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionError('Download failed.');
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!selectedDocumentId || !uploadFile) return;

    setActionError('');
    const session = getSession();
    const formData = new FormData();
    formData.append('file', uploadFile);
    if (uploadNotes.trim()) {
      formData.append('notes', uploadNotes.trim());
    }

    const res = await fetch(
      `/api/documents/${selectedDocumentId}/revisions`,
      {
        method: 'POST',
        headers: session
          ? { Authorization: `Bearer ${session.accessToken}` }
          : {},
        body: formData,
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setActionError(body.message ?? 'Upload failed');
      return;
    }

    setUploadFile(null);
    setUploadNotes('');
    utils.document.get.invalidate({ documentId: selectedDocumentId });
    utils.document.revisions.invalidate({ documentId: selectedDocumentId });
    utils.document.listByProduct.invalidate({ productId });
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!productId) return;
    createMutation.mutate({
      productId,
      name: createForm.name,
      docType: createForm.docType || undefined,
    });
  }

  function nextTransition(status: string): 'IN_REVIEW' | 'RELEASED' | null {
    if (status === 'DRAFT') return 'IN_REVIEW';
    if (status === 'IN_REVIEW') return 'RELEASED';
    return null;
  }

  const previewable =
    selectedRevision &&
    (selectedRevision.mimeType.startsWith('image/') ||
      selectedRevision.mimeType === 'application/pdf');

  const error =
    actionError ||
    createMutation.error?.message ||
    transitionMutation.error?.message ||
    documentsQuery.error?.message ||
    '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-tour="plm-documents-header">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Product lifecycle documents with immutable revision history
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="product">Select product</Label>
            <select
              id="product"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setSelectedDocumentId(null);
                setPreviewRevisionId(null);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
            >
              {(productsQuery.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.description}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="search">Search documents</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or type"
              className="mt-1"
            />
          </div>
          {editable && (
            <div className="flex items-end">
              <Button onClick={() => setShowCreate((v) => !v)}>
                {showCreate ? 'Cancel' : 'New document'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && editable && (
        <Card>
          <CardHeader>
            <CardTitle>Create document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="doc-name">Name</Label>
                <Input
                  id="doc-name"
                  required
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="doc-type">Type</Label>
                <Input
                  id="doc-type"
                  value={createForm.docType}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, docType: e.target.value }))
                  }
                  placeholder="drawing, spec, manual"
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {!productId ? (
              <p className="text-sm text-muted-foreground">Select a product.</p>
            ) : documentsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (documentsQuery.data?.items.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents for this product.
              </p>
            ) : (
              <ul className="divide-y">
                {documentsQuery.data!.items.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className={`w-full px-2 py-3 text-left hover:bg-slate-50 ${
                        selectedDocumentId === doc.id ? 'bg-slate-100' : ''
                      }`}
                      onClick={() => {
                        setSelectedDocumentId(doc.id);
                        setPreviewRevisionId(null);
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }}
                    >
                      <div className="font-medium">{doc.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {doc.docType ?? '—'} · current rev{' '}
                        {doc.currentRevision?.revisionNumber ?? '—'} · released{' '}
                        {doc.releasedRevision?.revisionNumber ?? '—'}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revision history</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDocumentId ? (
              <p className="text-sm text-muted-foreground">
                Select a document to view revisions.
              </p>
            ) : revisionsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (revisionsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet.</p>
            ) : (
              <ul className="space-y-3">
                {(revisionsQuery.data ?? []).map((rev) => {
                  const next = nextTransition(rev.status);
                  return (
                    <li
                      key={rev.id}
                      className="rounded-md border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">
                            Rev {rev.revisionNumber}
                          </span>{' '}
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                            {rev.status}
                          </span>
                          <div className="text-muted-foreground">
                            {rev.fileName} ({rev.sizeBytes} bytes)
                          </div>
                          {rev.notes && (
                            <div className="text-xs text-muted-foreground">
                              {rev.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(rev)}
                          >
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(rev)}
                          >
                            Download
                          </Button>
                          {editable && next && (
                            <Button
                              size="sm"
                              disabled={transitionMutation.isPending}
                              onClick={() =>
                                transitionMutation.mutate({
                                  revisionId: rev.id,
                                  targetStatus: next,
                                })
                              }
                            >
                              → {next.replace('_', ' ')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedDocumentId && editable && (
        <Card>
          <CardHeader>
            <CardTitle>Upload revision</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  className="mt-1"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setUploadFile(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={!uploadFile}>
                  Upload revision
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {previewUrl && selectedRevision && previewable && (
        <Card>
          <CardHeader>
            <CardTitle>
              Preview — rev {selectedRevision.revisionNumber}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRevision.mimeType.startsWith('image/') ? (
              <img
                src={previewUrl}
                alt={selectedRevision.fileName}
                className="max-h-[480px] rounded border"
              />
            ) : (
              <iframe
                src={previewUrl}
                title={selectedRevision.fileName}
                className="h-[480px] w-full rounded border"
              />
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
export function KidsImport() {
  const [preview,setPreview] = useState<any>(null);
  const [result,setResult] = useState<any>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  async function run(apply:boolean) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/internal/shopify/kids-import', apply ? {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({revision:preview.revision})
      } : {cache:'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Import could not be verified. Refresh the preview.');
      if (apply) {setResult(data);setPreview(null);} else {setPreview(data);setResult(null);}
    } catch(e) {setError(e instanceof Error ? e.message : 'Import failed.');} finally {setBusy(false);}
  }
  return <div className="space-y-5 max-w-3xl">
    <h1 className="text-2xl font-semibold">Import Shopify Kids Bed collection</h1>
    <p>Import the reviewed six beds and their 106 sellable options, with unique SKUs, Shopify links, descriptions, images and retail prices.</p>
    <p>Existing Tiny Cloud and Suger Snap production records are preserved. New variants need production materials and costs checked. All imported beds use 90 cm height. Draft products stay inactive in the ERP.</p>
    <p>This is a one-time catalog import. It does not enable automatic order, price, or stock syncing. Imported stock starts at zero; Shopify stock is not changed.</p>
    <Button onClick={()=>run(false)} disabled={busy}>Review import</Button>
    {busy && <p role="status">{preview ? 'Importing…' : 'Loading…'}</p>}
    {error && <p role="alert">{error}</p>}
    {preview && <><p>{preview.linked} of {preview.total} Shopify variants already linked.</p>
      <table className="w-full text-left"><thead><tr><th>Bed</th><th>Status</th><th>Options</th><th>To import</th></tr></thead>
      <tbody>{preview.products.map((p:any)=><tr key={p.name}><td>{p.name}</td><td>{p.status}</td><td>{p.variants}</td><td>{p.pending}</td></tr>)}</tbody></table>
      <Button onClick={()=>run(true)} disabled={busy || preview.linked===preview.total}>Import missing variants</Button></>}
    {result && <p role="status">Import complete: {result.imported} variants imported; {result.linked} Shopify variants linked. Existing production records preserved.</p>}
    <p><a className="underline" href="/products">Open ERP products</a></p>
  </div>;
}

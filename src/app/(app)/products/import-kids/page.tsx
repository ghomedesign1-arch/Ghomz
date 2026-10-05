import { currentRole } from '@/lib/rbac';
import { KidsImport } from '@/components/products/kids-import';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Page() {
  if (await currentRole() !== 'ADMIN') redirect('/products');
  return <KidsImport />;
}

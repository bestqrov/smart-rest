import { redirect } from 'next/navigation'

// Merged into /superadmin/client (same accounts list + temporary-password action).
export default function CredentialsPage() {
  redirect('/superadmin/client')
}

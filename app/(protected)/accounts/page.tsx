import { UserCog } from 'lucide-react'

export default function AccountsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-green-50 rounded-full p-6 mb-4">
        <UserCog className="h-12 w-12 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Management</h1>
      <p className="text-muted-foreground">Manage team accounts and permissions — coming soon.</p>
    </div>
  )
}

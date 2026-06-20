import { redirect } from 'next/navigation'

// Root page — langsung redirect ke login
export default function RootPage() {
  redirect('/app/login')
}

import Link from 'next/link'
import { ad } from '@/lib/admin/ui'

export default function LoginAsButton({ userId }: { userId: string }) {
  return (
    <Link
      href={`/agency?as=${userId}`}
      target="_blank"
      className={`${ad.btnSecondary} px-2.5 py-1 text-xs`}
    >
      Login
    </Link>
  )
}

import Link from 'next/link'

export default function LoginAsButton({ userId }: { userId: string }) {
  return (
    <Link
      href={`/agency?as=${userId}`}
      target="_blank"
      className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
    >
      Login
    </Link>
  )
}

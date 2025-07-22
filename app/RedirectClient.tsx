'use client'

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function RedirectClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname === '/') {
      const newId = uuidv4()
      const params = new URLSearchParams(searchParams)
      const queryString = params.toString()
      router.replace(`/chat/${newId}${queryString ? `?${queryString}` : ''}`)
    } else {
      router.replace(`/widget/chat/`)
    }
  }, [pathname, searchParams, router])

  return <div>Redirecting...</div>
}

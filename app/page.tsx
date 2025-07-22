import { Suspense } from 'react'
import RedirectClient from './RedirectClient'
export const dynamic = "force-dynamic"; 


export default function Page() {
  return <Suspense fallback={<p>Loading chat...</p>}><RedirectClient /> </Suspense>
}

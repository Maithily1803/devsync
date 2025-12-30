'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export function LowCreditBanner() {
  const [credits, setCredits] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const res = await fetch('/api/credits/stats')
        const data = await res.json()
        setCredits(data.stats.current)
      } catch (error) {
        console.error('Failed to fetch credits:', error)
      }
    }

    fetchCredits()
  }, [])

  if (dismissed || credits === null || credits >= 50) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Low Credit Balance</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>
          You have {credits} credits remaining. Purchase more to continue using AI features.
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </Button>
          <Link href="/billing">
            <Button size="sm">Buy Credits</Button>
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  )
}
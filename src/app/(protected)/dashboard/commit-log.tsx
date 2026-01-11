'use client'

import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

const CommitLog = () => {
  const { projectId, project } = useProject()

  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    {
      enabled: !!projectId && !!project,
      refetchInterval: 30000
    }
  )

  // Keep only valid or generating commits, hide broken ones
  const cleanCommits = commits?.filter(commit => {
    const summary = (commit.summary || "").toLowerCase()

    if (
      summary.includes("failed") ||
      summary.includes("permanently") ||
      summary.includes("retry") ||
      summary.includes("unavailable")
    ) {
      return false
    }

    return true
  })

  if (!project || !projectId) {
    return (
      <div className="text-center py-10 sm:py-12 bg-white rounded-lg border">
        <p className="text-sm sm:text-base text-muted-foreground">
          Select a project to view commits
        </p>
      </div>
    )
  }

  return (
    <ul role="list" className="space-y-5 sm:space-y-6">

      {isLoading && !commits &&
        [1, 2, 3].map((i) => (
          <li
            key={i}
            className="animate-pulse bg-white rounded-md p-3 sm:p-4 ring-1 ring-gray-200"
          >
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </li>
        ))}

      {!isLoading && (!cleanCommits || cleanCommits.length === 0) && (
        <li className="text-center py-10 sm:py-12 bg-white rounded-lg border">
          <p className="text-sm sm:text-base text-muted-foreground">
            Commits are being processed. Check back in a few minutes.
          </p>
        </li>
      )}

      {cleanCommits?.map((commit, commitIdx) => (
        <li key={commit.id} className="relative flex gap-x-3 sm:gap-x-4">

          <div
            className={cn(
              commitIdx === cleanCommits.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className="w-px translate-x-1 bg-gray-200" />
          </div>

          <img
            src={commit.commitAuthorAvatar}
            alt={commit.commitAuthorName}
            className="relative mt-2 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-50 ring-1 ring-gray-100"
          />

          <div className="flex-auto rounded-md bg-white p-3 sm:p-4 ring-1 ring-gray-200 hover:ring-gray-300 transition">
            <div className="flex justify-between gap-x-3 mb-2">
              <Link
                target="_blank"
                href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 hover:text-gray-900"
              >
                <span className="font-medium text-gray-900">
                  {commit.commitAuthorName}
                </span>
                <span className="hidden sm:inline">committed</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              <time
                dateTime={commit.commitDate.toString()}
                className="text-xs text-gray-500"
                suppressHydrationWarning
              >
                {new Date(commit.commitDate).toLocaleString()}
              </time>
            </div>

            <h3 className="text-sm sm:text-base font-semibold text-gray-900">
              {commit.commitMessage}
            </h3>

            {commit.summary && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                {commit.summary.toLowerCase().includes("pending") ||
                 commit.summary.toLowerCase().includes("generating") ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="h-3 w-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                    Generating summary…
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-600 font-sans">
                    {commit.summary}
                  </pre>
                )}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default CommitLog

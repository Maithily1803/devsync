'use client'

import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink, AlertCircle } from 'lucide-react'

const CommitLog = () => {
  const { projectId, project } = useProject()

  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    {
      enabled: !!projectId && !!project,
      refetchInterval: 15000,
    }
  )

  const cleanCommits = React.useMemo(() => {
    if (!commits) return []

    return commits.filter(commit => {
      const summary = (commit.summary || "").toLowerCase()
      if (summary.includes("permanently failed")) {
        return false
      }
      return true
    })
  }, [commits])

  const generatingCount = React.useMemo(() => {
    if (!cleanCommits) return 0
    return cleanCommits.filter(c => {
      const s = (c.summary || "").toLowerCase()
      return s.includes("generating") || s.includes("pending")
    }).length
  }, [cleanCommits])

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
    <div className="space-y-4">
      {generatingCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-md text-sm">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span>Processing {generatingCount} commit{generatingCount > 1 ? 's' : ''}...</span>
        </div>
      )}

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

        {!isLoading && cleanCommits.length === 0 && (
          <li className="text-center py-10 sm:py-12 bg-white rounded-lg border">
            <div className="flex flex-col items-center gap-3">
              <AlertCircle className="h-10 w-10 text-gray-300" />
              <div>
                <p className="text-sm sm:text-base font-medium text-gray-900">
                  No commits found
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Make sure your repository has commits and is properly connected
                </p>
              </div>
            </div>
          </li>
        )}

        {cleanCommits.map((commit, commitIdx) => {
          const isGenerating =
            commit.summary?.toLowerCase().includes("generating") ||
            commit.summary?.toLowerCase().includes("pending")

          return (
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
                    className="text-xs text-gray-500 shrink-0"
                    suppressHydrationWarning
                  >
                    {new Date(commit.commitDate).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                </div>

                <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                  {commit.commitMessage}
                </h3>

                {commit.summary && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    {isGenerating ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="h-3 w-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                        <span>Generating AI summary...</span>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-xs sm:text-sm text-gray-600 font-sans leading-relaxed">
                        {commit.summary}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default CommitLog


'use client'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

const CommitLog = () => {
  const { projectId, project } = useProject()

  // Run query only once projectId exists
  const { data: commits, isLoading } = api.project.getCommits.useQuery(
    { projectId },
    { enabled: !!projectId }
  )

  if (isLoading) return <p>Loading commits...</p>
  if (!commits?.length) return <p className='text-gray-500'>No commits found.</p>

  return (
    <ul className='space-y-6'>
      {commits.map((commit, commitIdx) => (
        <li key={commit.id} className='relative flex gap-x-4'>
          {/* Timeline line connector */}
          <div
            className={cn(
              commitIdx === commits.length - 1 ? 'h-6' : '-bottom-6',
              'absolute left-0 top-0 flex w-6 justify-center'
            )}
          >
            <div className='w-px translate-x-1 bg-gray-200' />
          </div>

          {/* Commit avatar */}
          <img
            src={commit.commitAuthorAvatar}
            alt='commit avatar'
            className='relative mt-1 size-8 flex-none rounded-full bg-gray-50'
          />

          {/* Commit details */}
          <div className='flex-auto rounded-md p-3 ring-1 ring-inset ring-gray-200'>
            <div className='flex items-center justify-between'>
              <div className='flex justify-between gap-x-4'>
                <Link
                  target='_blank'
                  href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                  className='py-0.5 text-xs leading-5 text-gray-500'
                >
                  <span className='font-medium text-gray-900'>
                    {commit.commitAuthorName}
                  </span>{' '}
                  <span className='inline-flex items-center'>
                    committed
                    <ExternalLink className='ml-1 size-4' />
                  </span>
                </Link>
              </div>
            </div>

            {/* Commit message */}
            <span className='block mt-2 font-semibold'>
              {commit.commitMessage}
            </span>

            {/* Commit summary */}
            {commit.summary && (
              <pre className='mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-500'>
                {commit.summary}
              </pre>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default CommitLog


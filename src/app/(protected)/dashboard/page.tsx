// src/app/(protected)/dashboard/page.tsx
'use client'
import useProject from '@/hooks/use-project'
import { ExternalLink, Github } from 'lucide-react'
import React from 'react'
import Link from 'next/link'
import CommitLog from './commit-log'
import AskQuestionCard from './ask-question-card'
import MeetingCard from './meeting-card'
import ArchiveButton from './archive-button'
import InviteButton from './invite-button'
import TeamMembers from './team-members'

const DashboardPage = () => {
    const {project} = useProject()

  return (
    <div className='w-full max-w-full text-[15px] sm:text-base'>
        <div className='flex items-center justify-between flex-wrap gap-y-4 rounded-md'>
          {/* GitHub link */}
         <div
  className="
    w-full sm:w-fit
    rounded-md
    bg-primary
    px-4 py-3
    max-w-full
  "
>
  <div className="flex items-start gap-2">
    <Github className="size-5 text-white shrink-0 mt-0.5" />

    <p
      className="
        text-xs sm:text-sm
        font-medium
        text-white
        break-all
        leading-relaxed
      "
    >
      This project is linked to{' '}
      <Link
        href={project?.githubUrl ?? ''}
        target="_blank"
        className="
          inline-flex items-center gap-1
          text-white/80
          hover:underline
          break-all
        "
      >
        {project?.githubUrl}
        <ExternalLink className="size-4 shrink-0" />
      </Link>
    </p>
  </div>
</div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <TeamMembers />
            <InviteButton />
            <ArchiveButton />
          </div>
        </div>

        <div className="mt-4 w-full">
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-5 w-full'>
            <AskQuestionCard />
            {project ? (
              <MeetingCard project={project} />
            ) : (
              <div className="col-span-2 flex items-center justify-center rounded-md border p-10 text-base text-gray-500">
                Select a project to upload meetings
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 w-full">
          <CommitLog />
        </div>
    </div>
  )
}

export default DashboardPage
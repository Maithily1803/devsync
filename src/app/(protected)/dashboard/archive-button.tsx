'use client'
import { Button } from '@/components/ui/button'
import useProject from '@/hooks/use-project'
import useRefetch from '@/hooks/use-refetch'
import { api } from '@/trpc/react'
import React from 'react'
import { toast } from 'sonner'

const ArchiveButton = () => {
  const archiveProject = api.project.archiveProject.useMutation()
  const { projectId } = useProject()
  const refetch = useRefetch()

  return (
    <Button
      disabled={archiveProject.isPending}
      size="lg"
      variant="destructive"
      className="
        /* base behavior */
        cursor-pointer
        disabled:cursor-not-allowed
        transition-all duration-200
        hover:bg-destructive/90
        hover:scale-[1.03]
        active:scale-[0.97]

        /* responsive layout */
        w-full sm:w-auto
        shrink-0
        text-sm sm:text-sm
        px-4 sm:px-6
        py-2 sm:py-3
      "
      onClick={() => {
        const confirm = window.confirm(
          'Are you sure you want to archive this project?'
        )
        if (confirm) {
          archiveProject.mutate(
            { projectId },
            {
              onSuccess: () => {
                toast.success('Project archived')
                refetch()
              },
              onError: () => {
                toast.error('Failed to archive project')
              },
            }
          )
        }
      }}
    >
      Archive
    </Button>
  )
}

export default ArchiveButton



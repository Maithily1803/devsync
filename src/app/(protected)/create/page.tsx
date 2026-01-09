'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useRefetch from '@/hooks/use-refetch'
import { api } from '@/trpc/react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import useProject from '@/hooks/use-project'

type FormInput = {
  repoUrl: string
  projectName: string
}

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>()
  const createProject = api.project.createProject.useMutation()
  const refetch = useRefetch()
  const router = useRouter()
  const { setProjectId } = useProject()

  function onSubmit(data: FormInput) {
    createProject.mutate(
      {
        githubUrl: data.repoUrl,
        name: data.projectName,
      },
      {
        onSuccess: (project) => {
          toast.success('Project created!')
          refetch()
          reset()
          
          //new project as active
          setProjectId(project.id)
          
          //redirect to dashboard with the new project
          router.push('/dashboard')
        },
        onError: (error: any) => {
          if (error.message.includes('404')) {
            toast.error('Repository not found')
          } else if (error.message.includes('401') || error.message.includes('403')) {
            toast.error('GitHub authentication failed')
          } else if (error.message.includes('Insufficient credits')) {
            toast.error('Insufficient credits. Please purchase more credits.')
          } else {
            toast.error(error.message || 'Failed to create project')
          }
        },
      }
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-8">
      <div className="flex w-full max-w-4xl flex-col-reverse items-center gap-8 lg:flex-row lg:gap-12">
        
        <img
          src="/undraw_github.svg"
          alt="GitHub"
          className="hidden lg:block w-full max-w-[260px]"
        />
        {/* form */}
        <div className="w-full max-w-md space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold">
              Link GitHub Repository
            </h1>
            <p className="text-sm text-muted-foreground">
              Connect a public repo to start analyzing
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Project Name
              </label>
              <Input
                {...register('projectName', { required: true })}
                placeholder="My Project"
                disabled={createProject.isPending}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">
                GitHub URL
              </label>
              <Input
                {...register('repoUrl', { required: true })}
                placeholder="github.com/user/repo"
                disabled={createProject.isPending}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                * remove .git from the URL if present
              </p>
            </div>

            <Button
              type="submit"
              disabled={createProject.isPending}
              className="w-full font-medium cursor-pointer"
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </form>

          {createProject.isPending && (
            <Alert>
              <AlertDescription className="text-xs">
                Setting up project.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}

export default CreatePage
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

type FormInput = {
  repoUrl: string
  projectName: string
}

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>()
  const createProject = api.project.createProject.useMutation()
  const refetch = useRefetch()

  function onSubmit(data: FormInput) {
    createProject.mutate(
      {
        githubUrl: data.repoUrl,
        name: data.projectName,
      },
      {
        onSuccess: () => {
          toast.success('🎉 Project created! Indexing repository in background...')
          refetch()
          reset()
        },
        onError: (error: any) => {
          console.error('❌ Error:', error)
          
          if (error.message.includes('404')) {
            toast.error('Repository not found. Make sure the repo is public and URL is correct.')
          } else if (error.message.includes('401') || error.message.includes('403')) {
            toast.error('Authentication failed. Check GITHUB_TOKEN in .env')
          } else {
            toast.error(error.message || 'Failed to create project')
          }
        },
      }
    )
  }

  return (
    <div className="flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 px-4 sm:px-6 py-8 min-h-full">
      {/* Illustration */}
      <img
        src="/undraw_github.svg"
        alt="GitHub"
        className="hidden lg:block w-full max-w-xs sm:max-w-sm h-auto"
      />

      {/* Form */}
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="font-semibold text-2xl sm:text-4xl">
            Link your GitHub Repository
          </h1>
          <p className="mt-2 text-sm sm:text-lg text-muted-foreground">
            Connect any public repository to start analyzing
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Public repositories only.</strong> Works with GitHub URLs ending in .git or without it.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Project Name
            </label>
            <Input
              {...register('projectName', { required: true })}
              placeholder="My Awesome Project"
              className="text-sm sm:text-base"
              disabled={createProject.isPending}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">
              GitHub Repository URL
            </label>
            <Input
              {...register('repoUrl', { required: true })}
              placeholder="https://github.com/username/repo"
              className="text-sm sm:text-base"
              disabled={createProject.isPending}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Examples: github.com/vercel/next.js or github.com/vercel/next.js.git
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={createProject.isPending}
            className="w-full cursor-pointer text-sm sm:text-base font-semibold"
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </form>

        {createProject.isPending && (
          <Alert>
            <AlertDescription className="text-xs">
              ⏳ Setting up your project... This takes 2-5 minutes for large repos. You can navigate away safely.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}

export default CreatePage
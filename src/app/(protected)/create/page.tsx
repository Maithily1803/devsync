'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useRefetch from '@/hooks/use-refetch'
import { api } from '@/trpc/react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

type FormInput = {
  repoUrl: string
  projectName: string
  githubToken?: string
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
        githubToken: data.githubToken,
      },
      {
        onSuccess: () => {
          toast.success('Project created successfully')
          refetch()
          reset()
        },
        onError: () => {
          toast.error('Failed to create project')
        },
      }
    )
  }

  return (
    <div
      className="
        flex flex-col
        lg:flex-row
        items-center
        justify-center
        gap-10 lg:gap-16
        px-4 sm:px-6
        py-8
        min-h-full
      "
    >
      {/* Illustration — hidden on mobile */}
      <img
        src="/undraw_github.svg"
        alt="GitHub illustration"
        className="
          hidden
          lg:block
          w-full
          max-w-xs sm:max-w-sm
          h-auto
        "
      />

      {/* Form */}
      <div className="w-full max-w-md">
        <div>
          <h1 className="font-semibold text-2xl sm:text-4xl">
            Link your GitHub Repository
          </h1>
          <p className="mt-2 text-sm sm:text-lg text-muted-foreground">
            Enter the URL of your repository to link it to Devsync
          </p>
        </div>

        <div className="h-6" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Input
            className="text-sm sm:text-base"
            {...register('projectName', { required: true })}
            placeholder="Project Name"
          />

          <Input
            className="text-sm sm:text-base"
            {...register('repoUrl', { required: true })}
            placeholder="GitHub URL"
            type="url"
            required
          />

          <Input
            className="text-sm sm:text-base"
            {...register('githubToken')}
            placeholder="GitHub Token (optional)"
          />

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              disabled={createProject.isPending}
              className="
                w-full
                cursor-pointer
                text-sm sm:text-base
                font-semibold
                disabled:cursor-not-allowed
                transition-all duration-200
                hover:bg-primary/90
                hover:scale-[1.03]
                active:scale-[0.97]
                disabled:scale-100
              "
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreatePage

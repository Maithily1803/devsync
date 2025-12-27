'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import useProject from '@/hooks/use-project'
import React from 'react'
import Image from 'next/image'
import { askQuestion } from './actions'
import { readStreamableValue } from '@ai-sdk/rsc'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from './code-references'
import { api } from '@/trpc/react'
import { toast } from 'sonner'
import useRefetch from '@/hooks/use-refetch'

const AskQuestionCard = () => {
  const { project } = useProject()
  const [open, setOpen] = React.useState(false)
  const [question, setQuestion] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [answer, setAnswer] = React.useState('')
  const [filesReferences, setFilesReferences] = React.useState<
    { fileName: string; sourceCode: string; summary: string }[]
  >([])
  const saveAnswer = api.project.saveAnswer.useMutation()
  const refetch = useRefetch()

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!project?.id) return
    setLoading(true)
    setAnswer('')
    setFilesReferences([])

    const { output, filesReferences } = await askQuestion(question, project.id)
    setOpen(true)
    setFilesReferences(filesReferences)

    for await (const delta of readStreamableValue(output)) {
      if (delta) setAnswer((ans) => ans + delta)
    }
    setLoading(false)
  }

  return (
    <>
      {/* ---------------- Dialog ---------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="
            w-[95vw]
            max-w-full
            sm:max-w-[80vw]
            text-sm sm:text-lg
            px-4 sm:px-6
          "
        >
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <DialogTitle>
                <Image src="/logo.png" alt="devsync" width={36} height={36} />
              </DialogTitle>

              <Button
                disabled={saveAnswer.isPending}
                variant="outline"
                className="
                  w-full sm:w-auto
                  text-sm sm:text-base
                  px-3 sm:px-4
                  shrink-0
                "
                onClick={() => {
                  saveAnswer.mutate(
                    {
                      projectId: project!.id,
                      question,
                      answer,
                      filesReferences,
                    },
                    {
                      onSuccess: () => {
                        toast.success('Answer saved!')
                        refetch()
                      },
                      onError: () => {
                        toast.error('Failed to save answer!')
                      },
                    }
                  )
                }}
              >
                Save Answers
              </Button>
            </div>
          </DialogHeader>

          {/* Answer */}
          <MDEditor.Markdown
            source={answer}
            className="
              max-w-full
              max-h-[45vh]
              overflow-auto
              break-words
              text-sm sm:text-lg
            "
          />

          <div className="h-4" />
          <CodeReferences filesReferences={filesReferences} />

          <Button
            type="button"
            className="w-full sm:w-auto shrink-0"
            onClick={() => {
              setOpen(false)
              setAnswer('')
            }}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* ---------------- Card ---------------- */}
      <Card className="relative col-span-1 sm:col-span-3 text-base sm:text-lg">
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              className="
                text-base sm:text-xl
                placeholder:text-sm sm:placeholder:text-base
                leading-relaxed
                min-h-[85px]
                px-3 sm:px-4
                py-2 sm:py-3
              "
              placeholder="Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />

            <div className="h-6 sm:h-8" />

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="
                w-full sm:w-auto
                text-sm sm:text-base
                font-semibold
                cursor-pointer
                disabled:cursor-not-allowed
                transition-all duration-200
                hover:bg-primary/90
                hover:scale-[1.03]
                active:scale-[0.97]
              "
            >
              {loading ? 'Thinking...' : 'Ask Devsync!'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default AskQuestionCard



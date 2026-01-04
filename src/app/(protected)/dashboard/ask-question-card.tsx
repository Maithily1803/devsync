'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import useProject from '@/hooks/use-project'
import React from 'react'
import Image from 'next/image'
import { askQuestion } from './actions'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from './code-references'
import { api } from '@/trpc/react'
import { toast } from 'sonner'
import useRefetch from '@/hooks/use-refetch'
import { Loader2 } from 'lucide-react'

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
    if (!project?.id || !question.trim()) return

    setLoading(true)
    setAnswer('')
    setFilesReferences([])

    try {
      const { answer, filesReferences } = await askQuestion(
        question,
        project.id
      )

      setOpen(true)
      setAnswer(answer)
      setFilesReferences(filesReferences)

      if (answer) {
        saveAnswer.mutate(
          {
            projectId: project.id,
            question,
            answer,
            filesReferences,
          },
          {
            onSuccess: () => {
              toast.success('Answer saved automatically!')
              refetch()
            },
            onError: () => {
              toast.error('Failed to save answer')
            },
          }
        )
      }
    } catch {
      toast.error('Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Answer dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="
            w-[95vw]
            max-w-[95vw]
            sm:max-w-[90vw]
            md:max-w-[80vw]
            lg:max-w-[70vw]
            max-h-[90vh]
            p-0
            flex flex-col
            overflow-hidden
          "
        >
          <DialogHeader className="px-4 sm:px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="devsync" width={28} height={28} />
              <DialogTitle className="text-base sm:text-lg font-semibold">
                Devsync Answer
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm sm:text-base font-semibold text-muted-foreground">
                Answer
              </h3>

              <div className="rounded-lg bg-muted/30 p-4 sm:p-5">
                <MDEditor.Markdown
                  source={answer || 'Generating answer...'}
                  className="
                    rounded-lg
                    prose prose-sm sm:prose
                    max-w-none
                    leading-relaxed
                    p-4 m-0
                  "
                />
              </div>
            </div>

            {filesReferences.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm sm:text-base font-semibold text-muted-foreground">
                  Code References
                </h3>
                <CodeReferences filesReferences={filesReferences} />
              </div>
            )}
          </div>

          <div className="border-t px-4 sm:px-6 py-3">
            <Button
              type="button"
              className="w-full text-sm sm:text-base"
              onClick={() => {
                setOpen(false)
                setQuestion('')
                setAnswer('')
              }}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ask question card */}
      <Card className="col-span-1 sm:col-span-3">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg font-semibold">
            Ask a question
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Textarea
              className="
                text-sm sm:text-base
                leading-relaxed
                min-h-[110px]
                resize-none
              "
              placeholder="Eg: Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={loading}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full text-sm sm:text-base cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking…
                </>
              ) : (
                'Ask Devsync'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default AskQuestionCard

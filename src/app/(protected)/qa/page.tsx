'use client'

import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import AskQuestionCard from '../dashboard/ask-question-card'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from '../dashboard/code-references'
import { useUser } from '@clerk/nextjs'
import { Trash2, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import useRefetch from '@/hooks/use-refetch'

/* ================= TYPES ================= */

type FileReference = {
  fileName: string
  sourceCode: string
  summary: string
}

function isFileReferenceArray(value: unknown): value is FileReference[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        'fileName' in v &&
        'sourceCode' in v &&
        'summary' in v
    )
  )
}

const QAPage = () => {
  const { projectId } = useProject()
  const { data: questions, isLoading } =
    api.project.getQuestions.useQuery({ projectId })

  const deleteQuestion = api.project.deleteQuestion.useMutation()
  const { user } = useUser()
  const refetch = useRefetch()

  const [questionIndex, setQuestionIndex] = React.useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [questionToDelete, setQuestionToDelete] =
    React.useState<string | null>(null)

  const question = questions?.[questionIndex]

  const handleDelete = () => {
    if (!questionToDelete) return

    deleteQuestion.mutate(
      { questionId: questionToDelete },
      {
        onSuccess: () => {
          toast.success('Question deleted')
          refetch()
          setDeleteDialogOpen(false)
          setQuestionToDelete(null)
        },
        onError: () => toast.error('Failed to delete question'),
      }
    )
  }

  return (
    <div className="w-full">
      <Sheet>
        <div className="mb-6">
          <AskQuestionCard />
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 space-y-3">
          <div className="flex justify-between items-center">
            <h1 className="text-lg sm:text-xl font-semibold">
              Saved Questions
            </h1>
            {questions && (
              <span className="text-sm text-muted-foreground">
                {questions.length} questions
              </span>
            )}
          </div>

          {/* ⏳ LOADING SKELETON */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4 items-center rounded-lg border bg-white p-4"
                >
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ✅ EMPTY STATE */}
          {!isLoading && questions && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-white">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <HelpCircle className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">No saved questions yet</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Ask questions about your project and save them here for quick access later.
              </p>
            </div>
          )}

          {/* ✅ QUESTIONS LIST */}
          {!isLoading && questions && questions.length > 0 && (
            <div className="space-y-3">
              {questions.map((q, index) => (
                <SheetTrigger
                  key={q.id}
                  onClick={() => setQuestionIndex(index)}
                  className="w-full text-left cursor-pointer"
                >
                  <div className="rounded-lg border bg-white p-4 hover:shadow-sm transition">
                    <div className="flex gap-4 items-center">
                      <img
                        src={user?.imageUrl || '/default-avatar.png'}
                        className="w-10 h-10 rounded-full border"
                        alt="avatar"
                      />

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm sm:text-base font-medium truncate">
                            {q.question}
                          </p>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setQuestionToDelete(q.id)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {q.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                </SheetTrigger>
              ))}
            </div>
          )}
        </div>

        <SheetContent className="w-[95vw] sm:max-w-[80vw] p-0 overflow-y-auto">
          {question && (
            <>
              <SheetHeader className="border-b px-6 py-4">
                <SheetTitle className="text-base sm:text-lg font-semibold pr-10">
                  {question.question}
                </SheetTitle>
              </SheetHeader>

              <div className="px-6 py-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Answer:</h3>
                  <div className="rounded-lg border bg-white">
                    <MDEditor.Markdown
                      source={question.answer}
                      className=" prose prose-sm sm:prose max-w-none p-4 m-0"
                    />
                  </div>
                </div>

                {isFileReferenceArray(question.filesReferences) && (
                  <>
                    <div className="border-t" />
                    <CodeReferences
                      filesReferences={question.filesReferences}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="cursor-pointer bg-primary"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default QAPage

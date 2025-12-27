'use client'

import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import AskQuestionCard from '../dashboard/ask-question-card'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from '../dashboard/code-references'
import { useUser } from '@clerk/nextjs'
import { X } from 'lucide-react'

const QAPage = () => {
  const { projectId } = useProject()
  const { data: questions } = api.project.getQuestions.useQuery({ projectId })
  const { user } = useUser()
  const [questionIndex, setQuestionIndex] = React.useState(0)

  const question = questions?.[questionIndex]

  return (
    <Sheet>
      {/* Ask Question */}
      <AskQuestionCard />

      <div className="mx-auto max-w-6xl px-3 py-6 space-y-3">
        <h1 className="text-lg sm:text-xl font-semibold">Saved Questions</h1>

        <div className="flex flex-col gap-3">
          {questions?.map((q, index) => (
            <SheetTrigger key={q.id} onClick={() => setQuestionIndex(index)}>
              <div
                className="
                  flex items-center gap-4
                  bg-white
                  rounded-lg
                  p-4
                  border
                  shadow-sm
                  cursor-pointer
                  transition-all duration-200
                  hover:shadow-md
                  hover:border-primary/40
                  active:scale-[0.99]
                "
              >
                <img
                  className="w-8 h-8 rounded-full border shrink-0"
                  src={user?.imageUrl || '/default-avatar.png'}
                  alt="User avatar"
                  onError={(e) =>
                    (e.currentTarget.src = '/default-avatar.png')
                  }
                />

                <div className="flex flex-col flex-1 min-w-0 text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm sm:text-base font-medium text-gray-700 line-clamp-1">
                      {q.question}
                    </p>
                    <span className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">
                    {q.answer}
                  </p>
                </div>
              </div>
            </SheetTrigger>
          ))}
        </div>
      </div>

      {/* ---------------- Sheet ---------------- */}
      {question && (
        <SheetContent
            className="
              w-[90vw]
              max-w-[90vw]
              sm:max-w-[75vw]
              md:max-w-[70vw]
              p-0
              overflow-y-auto
            "
          >


          {/* Sticky header ONLY */}
          <SheetHeader
            className="
              sticky top-0 z-10
              bg-background
              border-b
              px-4 sm:px-6
              py-4
            "
          >
            <div className="flex items-start justify-between gap-4">
              <SheetTitle className="text-lg sm:text-2xl font-semibold leading-snug">
                {question.question}
              </SheetTitle>

              <SheetClose asChild>
                <button
                  className="
                    p-2
                    rounded-md
                    cursor-pointer
                    transition
                    hover:bg-muted
                    active:scale-95
                  "
                  aria-label="Close"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Scrollable content */}
          <div className="px-4 sm:px-6 py-5 space-y-6">
            <MDEditor.Markdown
              source={question.answer}
              className="
                prose
                max-w-none
                prose-neutral
                leading-7
                text-sm sm:text-base
                rounded-lg
                bg-muted/30
                p-4 sm:p-5
              "
            />

            <div className="border-t" />

            <CodeReferences
              filesReferences={(question.filesReferences ?? []) as any}
            />
          </div>
        </SheetContent>
      )}
    </Sheet>
  )
}

export default QAPage

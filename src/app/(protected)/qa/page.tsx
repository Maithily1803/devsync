'use client'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import useProject from '@/hooks/use-project'
import { api } from '@/trpc/react'
import React from 'react'
import AskQuestionCard from '../dashboard/ask-question-card'
import MDEditor from '@uiw/react-md-editor'
import CodeReferences from '../dashboard/code-references'
import { useUser } from '@clerk/nextjs'  // Import Clerk useUser

const QAPage = () => {
  const { projectId } = useProject()
  const { data: questions } = api.project.getQuestions.useQuery({ projectId })
  const { user } = useUser()  // Current logged-in user from Clerk
  const [questionIndex, setQuestionIndex] = React.useState(0)
  const question = questions?.[questionIndex]

  return (
    <Sheet>
      <AskQuestionCard />
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6"></div>

      <h1 className="text-xl font-semibold">Saved Questions</h1>
      <div className="h-2"></div>
      <div className="flex flex-col gap-2">
        {questions?.map((question, index) => {
          return (
            <React.Fragment key={question.id}>
              <SheetTrigger onClick={() => setQuestionIndex(index)}>
                <div className="flex items-center gap-4 bg-white rounded-lg p-4 shadow border">
                  <img
                    className="w-8 h-8 object-cover rounded-full border"
                    height={32}
                    width={32}
                    src={user?.imageUrl || "/default-avatar.png"}  // Always use currently logged-in user's image
                    alt="User avatar"
                    onError={(e) => (e.currentTarget.src = "/default-avatar.png")}
                  />

                  <div className="text-left flex flex-col flex-1">
                    <div className="flex items-center gap-2 justify-between">
                      <p className="text-gray-700 line-clamp-1 text-lg font-medium">
                        {question.question}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(question.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-500 line-clamp-2 text-sm">
                      {question.answer}
                    </p>
                  </div>
                </div>
              </SheetTrigger>
            </React.Fragment>
          )
        })}
      </div>
      {question && (
        <SheetContent className="sm:max-w-[80vw]">
          <SheetHeader>
            <SheetTitle>{question.question}</SheetTitle>
            <MDEditor.Markdown source={question.answer} />
            <CodeReferences filesReferences={(question.filesReferences ?? []) as any} />
          </SheetHeader>
        </SheetContent>
      )}
    </Sheet>
  )
}

export default QAPage

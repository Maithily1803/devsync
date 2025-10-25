// src/app/(protected)/dashboard/ask-question-card.tsx
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
import MDEditor from '@uiw/react-md-editor';
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
  const [filesReferences, setFilesReferences] = React.useState<{ fileName: string; sourceCode: string; summary: string }[]>([])
  const saveAnswer = api.project.saveAnswer.useMutation()

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!project?.id) return
    setLoading(true)
    
    setAnswer('')
    setFilesReferences([])

    const { output, filesReferences } = await askQuestion(question, project.id)
    setOpen(true)
    // Set file references (they already use fileName in actions.ts)
    setFilesReferences(filesReferences)

    // Read streamable value and append to answer string
    for await (const delta of readStreamableValue(output)) {
      if (delta){setAnswer(ans => ans + delta)
    }
  }
    setLoading(false)
  }
  const refetch = useRefetch
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-[80vw]'>
          <DialogHeader>
            <div className="flex items-center gap-2">
            <DialogTitle>
              <Image src='/logo.png' alt='devsync' width={40} height={40} />
            </DialogTitle>
            <Button disabled={saveAnswer.isPending} variant={'outline'} onClick={() => {
              saveAnswer.mutate({
                projectId: project!.id,
                question,
                answer,
                filesReferences
              },{
                onSuccess: () => {
                  toast.success('Answer saved!')
                  refetch
                },
                onError: () => {
                  toast.error('Failed to save answer!')
                }
              })
            }}>
              Save Answers
            </Button>
            </div>
          </DialogHeader>

          
          <MDEditor.Markdown source={answer} className='max-w-full max-h-[40vh] overflow-auto'/>
          <div className="h-4"></div>
          <CodeReferences filesReferences={filesReferences} />
          <Button type='button' onClick={() => {setOpen(false); setAnswer('')}}>
            Close
          </Button>
          
        </DialogContent>
      </Dialog>

      <Card className='relative col-span-3'>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              placeholder='Which file should I edit to change the home page?'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className='h-4' />
            <Button type='submit' disabled={loading}>
              {loading ? 'Thinking...' : 'Ask Devsync!'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

export default AskQuestionCard




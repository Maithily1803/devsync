'use client'
import React from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { Copy, Check } from 'lucide-react'

type Props = {
  filesReferences: {
    fileName: string
    sourceCode: string
    summary: string
  }[]
}

const CodeReferences = ({ filesReferences }: Props) => {
  const [tab, setTab] = React.useState(filesReferences[0]?.fileName)
  const [copied, setCopied] = React.useState<string | null>(null)

  const handleCopy = async (code: string, fileName: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(fileName)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="w-full max-w-full text-sm sm:text-base">
      <Tabs value={tab} onValueChange={setTab}>
        {/* ---------------- Tabs Header ---------------- */}
        <div
          className="
            flex gap-2
            overflow-x-auto
            rounded-lg
            border
            bg-background
            p-2
            shadow-sm
          "
        >
          {filesReferences.map((file) => (
            <button
              key={file.fileName}
              onClick={() => setTab(file.fileName)}
              className={cn(
                `
                  cursor-pointer
                  px-3 py-1.5
                  text-xs sm:text-sm
                  font-medium
                  rounded-md
                  whitespace-nowrap
                  transition-all duration-150
                  shrink-0
                `,
                {
                  'bg-primary text-primary-foreground shadow-sm':
                    tab === file.fileName,
                  'text-muted-foreground hover:bg-primary/70 hover:text-primary-foreground':
                    tab !== file.fileName,
                }
              )}
            >
              {file.fileName}
            </button>
          ))}
        </div>

        {/* ---------------- Code Viewer ---------------- */}
        {filesReferences.map((file) => (
          <TabsContent
            key={file.fileName}
            value={file.fileName}
            className="
              relative
              mt-3
              w-full
              rounded-lg
              border
              bg-[#2d1643]

              px-4 pt-4 pb-4
              pr-14

              overflow-visible
              sm:max-h-[45vh]
              sm:overflow-auto
            "
          >
            {/* Copy Button */}
            <button
              onClick={() => handleCopy(file.sourceCode, file.fileName)}
              className="
                absolute right-3 top-3
                cursor-pointer 
                flex items-center gap-1
                rounded-md
                bg-black/40
                px-2 py-1
                text-[11px] sm:text-xs
                text-white
                backdrop-blur
                transition
                hover:bg-black/60
                z-10
              "
            >
              {copied === file.fileName ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy
                </>
              )}
            </button>

            <SyntaxHighlighter
              language="typescript"
              style={nord}
              wrapLongLines
              customStyle={{
                margin: 0,
                background: 'transparent',
                boxSizing: 'border-box', // ✅ KEY FIX
                width: '100%',
                fontSize: '0.85rem',
              }}
            >
              {file.sourceCode}
            </SyntaxHighlighter>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default CodeReferences

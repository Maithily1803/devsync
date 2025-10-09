
import { Github } from 'lucide-react';
import { Octokit } from "@octokit/rest";
import { db } from '@/server/db';

export const octokit = new Octokit ({
    auth: process.env.GITHUB_TOKEN
});

const githubUrl = 'https://github.com/docker/genai-stack'

type Response = {
    commitHash: string;
    commitMessage : string ;      
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate  :  string;          
    }


export const getCommitHashes = async (githubUrl: string): Promise<Response[]> => {

    const [owner, repo] = githubUrl.split('/').slice(-2)
    if (!owner || !repo){
        throw new Error("Invalid GitHub URL")
    }
    const {data} = await octokit.rest.repos.listCommits({
        owner,
        repo
    })
    const sortedCommits = data.sort((a: any, b: any) => new Date(b.commit.author.date).getTime() - new Date(a.commit.author.date).getTime())as any[]

    return sortedCommits.slice(0,15).map((commit: any) => ({
        commitHash: commit.sha as string,
        commitMessage: commit.commit.message ?? "",
        commitAuthorName: commit.commit?.author?.name ?? "",
        commitAuthorAvatar: commit?.author?.avatar_url ?? "",
        commitDate: commit.commit?.author?.date ?? ""
    }))
}
export const pollCommits = async (projectId: string) => {
    const {project, githubUrl} = await fetchProjectGithubUrl(projectId)
    const commitHashes = await getCommitHashes(githubUrl)
    const unprocessedCommits = await filterUnprocessedCommits(projectId, commitHashes)
    return unprocessedCommits
}





async function fetchProjectGithubUrl(projectId: string){
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: {
            githubUrl: true
        }
    })
    if (!project?.githubUrl) {
        throw new Error("Project has no GitHub URL")
    }
    return { project, githubUrl: project.githubUrl}
}

async function filterUnprocessedCommits(projectId: string, commitHashes: Response[]) {
  // Use the correct model name — usually "commit" should be "Commit"
  const processedCommits = await db.commit.findMany({
    where: { projectId },
  })

  // 👇 Add type annotation for processedCommit
  const unprocessedCommits = commitHashes.filter((commit) =>
    !processedCommits.some(
      (processedCommit: { commitHash: string }) =>
        processedCommit.commitHash === commit.commitHash
    )
  )

  return unprocessedCommits
}


await pollCommits('cmgexcdu5000658jn4i7aga2j').then(console.log)

import { pollCommits } from "@/lib/github"
import { createTRPCRouter, protectedProcedure } from "../trpc"
import { z } from "zod"
import { indexGithubRepo } from "@/lib/github-loader"
import { consumeCredits } from "@/lib/credit-service"
import { db } from "@/server/db"

export const projectRouter = createTRPCRouter({


  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Project name is required"),
        githubUrl: z.string().url("Invalid GitHub URL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId

      let user = await ctx.db.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        user = await ctx.db.user.create({
          data: {
            id: userId,
            emailAddress: "",
            credits: 100,
          },
        })
      }

      await db.user.create({
  data: {
    id: userId,
    emailAddress: "",
  },
});


      const project = await ctx.db.project.create({
  data: {
    name: input.name,
    githubUrl: input.githubUrl,
    UserToProjects: {
      create: { userId },
    },
  },
});

await consumeCredits(
  userId,
  "NEW_PROJECT",
  project.id,
  `Created project: ${input.name}`
);


      indexGithubRepo(project.id, input.githubUrl)
        .then(() => pollCommits(project.id))
        .catch(console.error)

      return project
    }),

  saveAnswer: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(), 
        filesReferences: z.array(
          z.object({
            fileName: z.string(),
            sourceCode: z.string(),
            summary: z.string().optional(),
            similarity: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, question, answer, filesReferences } = input

      return ctx.db.question.create({
        data: {
          projectId,
          question,
          answer,
          filesReferences,
          userId: ctx.userId,
        },
      })
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.question.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      })
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.question.delete({
        where: { id: input.questionId },
      })
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.project.findMany({
      where: {
        UserToProjects: { some: { userId: ctx.userId } },
        deletedAt: null,
      },
    })
  }),

  getCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      pollCommits(input.projectId).catch(console.error)

      return ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      })
    }),

  archiveProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.project.update({
        where: { id: input.projectId },
        data: { deletedAt: new Date() },
      })
    }),

  getTeamMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.userToProject.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
      })
    }),
})


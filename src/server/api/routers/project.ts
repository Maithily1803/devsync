import { pollCommits } from "@/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { indexGithubRepo } from "@/lib/github-loader";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Project name is required"),
        githubUrl: z.string().url("Invalid GitHub URL"),
        githubToken: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId; // ✅ directly available from auth()

      // ensure user exists
      await ctx.db.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          emailAddress: "", // Clerk auto-provided but safe to leave empty
        },
      });

      // ✅ Create project with correct URL
      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          githubUrl: input.githubUrl,
          githubToken: input.githubToken,
          UserToProjects: {
            create: { userId },
          },
        },
      });

      // ✅ Index and fetch commits
      await indexGithubRepo(project.id, input.githubUrl, input.githubToken);
      await pollCommits(project.id);

      return project;
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId; // ✅ use this consistently

    return await ctx.db.project.findMany({
      where: {
        UserToProjects: {
          some: { userId },
        },
        deletedAt: null,
      },
    });
  }),

  getCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      pollCommits(input.projectId).catch(console.error);
      return await ctx.db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });
    }),
    saveAnswer: protectedProcedure.input(z.object({
      projectId: z.string(),
      question: z.string(),
      answer: z.string(),
      filesReferences: z.any()
    })).mutation(async ({ ctx, input }) => {
      return await ctx.db.question.create({
        data:{
          answer: input.answer,
          filesReferences: input.filesReferences,
          projectId: input.projectId,
          question: input.question,
          userId: ctx.userId

        }
      })
    }),
    getQuestions: protectedProcedure.input(z.object({ projectId: z.string()}))
    .query(async ({ ctx, input}) =>{
      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId
        },
        include: {
          user: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    })
});

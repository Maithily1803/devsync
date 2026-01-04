// src/server/api/routers/project.ts
import { pollCommits } from "@/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { indexGithubRepo } from "@/lib/github-loader";
import { consumeCredits } from "@/lib/credit-service";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Project name is required"),
        githubUrl: z.string().url("Invalid GitHub URL"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // ✅ Ensure user exists
      await ctx.db.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          emailAddress: "",
          credits: 0, // New users start with 0 credits
        },
      });

      // ✅ Check and consume credits BEFORE creating project
      try {
        await consumeCredits(
          userId,
          "PROJECT_CREATED",
          undefined,
          `Created project: ${input.name}`
        );
      } catch (error: any) {
        // If InsufficientCreditsError, throw readable error
        if (error.name === "InsufficientCreditsError") {
          throw new Error("Insufficient credits. Please purchase more credits to create a project.");
        }
        throw error;
      }

      // ✅ Create project after credit deduction
      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          githubUrl: input.githubUrl,
          UserToProjects: {
            create: { userId },
          },
        },
      });

      // ✅ Background indexing (no await)
      indexGithubRepo(project.id, input.githubUrl)
        .then(() => {
          console.log(`✅ Indexing complete for project: ${project.id}`);
          return pollCommits(project.id);
        })
        .catch((err) => {
          console.error(`❌ Background indexing failed: ${err.message}`);
        });

      return project;
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.userId;

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

  saveAnswer: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answer: z.string(),
        filesReferences: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.question.create({
        data: {
          answer: input.answer,
          filesReferences: input.filesReferences,
          projectId: input.projectId,
          question: input.question,
          userId: ctx.userId,
        },
      });
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.question.delete({
        where: { id: input.questionId },
      });
    }),

  archiveProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.project.update({
        where: { id: input.projectId },
        data: { deletedAt: new Date() },
      });
    }),

  getTeamMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.userToProject.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
      });
    }),
});
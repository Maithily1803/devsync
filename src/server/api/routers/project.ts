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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      await ctx.db.user.upsert({
        where: { id: userId },
        update: {},
        create: {
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

  // ✅ NEW: Delete question
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

  saveMeetingTranscript: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        audioUrl: z.string(),
        transcript: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meeting.create({
        data: {
          name: input.name,
          projectId: input.projectId,
          audioUrl: input.audioUrl,
          transcript: input.transcript ?? null,
          status: input.status ?? "processing",
        },
      });
      return meeting;
    }),

  getMeetingTranscripts: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.meeting.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
    }),
});
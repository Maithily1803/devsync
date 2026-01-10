import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { indexGithubRepo } from "@/lib/github-loader";
import { pollCommits } from "@/lib/github";
import { consumeCredits } from "@/lib/credit-service";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        githubUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId;

      // Ensure user exists
      let user = await db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        user = await db.user.create({
          data: {
            id: userId,
            emailAddress: "",
            credits: 100,
          },
        });
      }

      const project = await db.project.create({
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
        .catch(console.error);

      return project;
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return db.project.findMany({
      where: {
        UserToProjects: { some: { userId: ctx.userId } },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getCommits: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      pollCommits(input.projectId).catch(console.error);

      return db.commit.findMany({
        where: { projectId: input.projectId },
        orderBy: { commitDate: "desc" },
      });
    }),

  archiveProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ input }) => {
      return db.project.update({
        where: { id: input.projectId },
        data: { deletedAt: new Date() },
      });
    }),

  getTeamMembers: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return db.userToProject.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
      });
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
      return db.question.create({
        data: {
          projectId: input.projectId,
          question: input.question,
          answer: input.answer,
          filesReferences: input.filesReferences,
          userId: ctx.userId,
        },
      });
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return db.question.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        include: { user: true },
      });
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.string() }))
    .mutation(async ({ input }) => {
      return db.question.delete({
        where: { id: input.questionId },
      });
    }),
});


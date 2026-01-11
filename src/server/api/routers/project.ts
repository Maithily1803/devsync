import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { indexGithubRepo } from "@/lib/github-loader";
import { pollCommits } from "@/lib/github";
import { consumeCredits } from "@/lib/credit-service";
import { TRPCError } from "@trpc/server";

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

      try {
        let user = await db.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          console.log("User not found, creating");
          user = await db.user.create({
            data: {
              id: userId,
              emailAddress: "",
              credits: 100,
            },
          });
        }

        if (user.credits < 50) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Insufficient credits. Please purchase more! ",
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

        console.log("Project created:", project.id);

        try {
          await consumeCredits(
            userId,
            "NEW_PROJECT",
            project.id,
            `Created project: ${input.name}`
          );
          console.log("Credits deducted for new project");
        } catch (creditError: any) {
          console.error("Credit deduction failed:", creditError.message);
          
          await db.project.delete({ where: { id: project.id } });
          
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to deduct credits.",
          });
        }

        indexGithubRepo(project.id, input.githubUrl)
          .then(() => {
            console.log("GitHub indexing completed");
            return pollCommits(project.id);
          })
          .then(() => {
            console.log("Initial commit polling completed");
          })
          .catch((error) => {
            console.error("Background indexing failed:", error.message);
          });

        return project;
      } catch (error: any) {
        console.error("Project creation failed:", error.message);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        if (error.message?.includes("404")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "GitHub repository not found. Check the URL and make sure it's public.",
          });
        }
        
        if (error.message?.includes("401") || error.message?.includes("403")) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "GitHub authentication failed. Check GITHUB_TOKEN environment variable.",
          });
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to create project",
        });
      }
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
      pollCommits(input.projectId).catch((err) => {
        console.error("Background commit polling failed:", err.message);
      });

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



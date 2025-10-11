import { pollCommits } from "@/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";

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
      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          githubUrl: input.githubUrl,
          githubToken: input.githubToken,
          UserToProjects: {
            create: {
              userId: ctx.user.userId!, // ensure user exists in context
            },
          },
        },
      });
      await pollCommits(project.id)
      return project;
    }),
    getProjects: protectedProcedure.query(async ({ ctx }) => 
    {
        return await ctx.db.project.findMany({
            where: {
                UserToProjects: {
                    some: {
                        userId: ctx.user.userId!
                    }
                },
                deletedAt: null
            }
        })
    }),
    getCommits: protectedProcedure.input(z.object({
      projectId: z.string()
    })).query(async ({ ctx,input }) => {
      pollCommits (input.projectId).then().catch(console.error)
      return await ctx.db.commit.findMany({where: {projectId: input.projectId}})
    })
});

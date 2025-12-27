import Razorpay from "razorpay"
import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { auth } from "@clerk/nextjs/server"
import { CREDIT_PLANS } from "@/lib/credit-plans"

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export async function POST(req: Request) {
  const { userId } = await auth()  // ✅ FIX

  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }
  const { planId } = await req.json()
  const plan = CREDIT_PLANS.find(p => p.id === planId)
  if (!plan) return NextResponse.json({ error: "Invalid plan" }, { status: 400 })

  const order = await razorpay.orders.create({
    amount: plan.price * 100,
    currency: "INR",
  })

  await db.payment.create({
    data: {
      userId,
      razorpayOrder: order.id,
      amount: plan.price,
      credits: plan.credits,
      status: "created",
    },
  })

  return NextResponse.json({ order })
}

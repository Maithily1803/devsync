import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { CREDIT_PLANS } from "@/lib/credit-plans";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await req.json();
    const plan = CREDIT_PLANS.find((p) => p.id === planId);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Ensure user exists
    await db.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        emailAddress: "",
      },
    });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: plan.price * 100, // Convert to paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        userId,
        planId: plan.id,
        credits: plan.credits.toString(),
      },
    });

    // Store payment record
    await db.payment.create({
      data: {
        userId,
        razorpayOrder: order.id,
        amount: plan.price,
        credits: plan.credits,
        status: "created",
      },
    });

    return NextResponse.json({ 
      order,
      plan: {
        name: plan.name,
        credits: plan.credits,
      }
    });
  } catch (error) {
    console.error("❌ Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
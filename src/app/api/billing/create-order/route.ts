// src/app/api/billing/create-order/route.ts
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { auth } from "@clerk/nextjs/server";
import { CREDIT_PLANS } from "@/lib/credit-plans";

// Validate Razorpay keys on startup
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("Razorpay keys not configured");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(req: Request) {
  try {
    console.log("🛒 Create order request started");

    const { userId } = await auth();

    if (!userId) {
      console.error("❌ No userId found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("👤 User ID:", userId);

    const body = await req.json();
    const { planId } = body;

    console.log("📦 Plan ID:", planId);

    // Find plan
    const plan = CREDIT_PLANS.find((p) => p.id === planId);

    if (!plan) {
      console.error("❌ Invalid plan:", planId);
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    console.log("✅ Plan found:", plan.name, "-", plan.credits, "credits");

    // Ensure user exists
    console.log("🔍 Checking user existence...");
    const existingUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      console.log("📝 Creating user record...");
      await db.user.create({
        data: {
          id: userId,
          emailAddress: "",
          credits: 0,
        },
      });
    }

    // Create Razorpay order
    console.log("💳 Creating Razorpay order...");
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

    console.log("✅ Razorpay order created:", order.id);

    // Save payment record
    console.log("💾 Saving payment record...");
    await db.payment.create({
      data: {
        userId,
        razorpayOrder: order.id,
        amount: plan.price,
        credits: plan.credits,
        status: "created",
      },
    });

    console.log("✅ Payment record saved");

    return NextResponse.json({
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      plan: {
        name: plan.name,
        credits: plan.credits,
      },
    });
  } catch (error: any) {
    console.error("❌ Create order error:", error);
    console.error("Stack:", error.stack);
    
    return NextResponse.json(
      { 
        error: "Failed to create order",
        details: error.message 
      },
      { status: 500 }
    );
  }
}
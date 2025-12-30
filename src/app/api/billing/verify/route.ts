import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = await req.json();

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const payment = await db.payment.findFirst({
      where: { razorpayOrder: razorpay_order_id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Update payment and add credits atomically
    await db.$transaction([
      db.payment.update({
        where: { id: payment.id },
        data: {
          razorpayPayId: razorpay_payment_id,
          status: "paid",
        },
      }),
      db.user.update({
        where: { id: payment.userId },
        data: {
          credits: { increment: payment.credits },
        },
      }),
    ]);

    return NextResponse.json({ 
      success: true,
      credits: payment.credits 
    });
  } catch (error) {
    console.error("❌ Verify payment error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
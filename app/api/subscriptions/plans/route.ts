import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { findUserByEmail, updateSubscription } from '@/lib/server/user-store';

export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free Trial',
    price: 0,
    currency: 'USD',
    credits: 100,
    features: [
      '100 Free Credits on Signup',
      'AI Teacher & Student Roles',
      'Multi-Language (English, Hindi, Marathi)',
      'Interactive Whiteboard',
    ],
  },
  {
    id: 'starter',
    name: 'Starter Learner',
    price: 9.99,
    currency: 'USD',
    credits: 1000,
    popular: true,
    features: [
      '1,000 Credits / month',
      'Natural Sarvam AI bulbul:v3 voices',
      'Unlimited Quizzes & Discussions',
      'Export Classroom Recordings',
      'Priority Cloud Execution',
    ],
  },
  {
    id: 'pro',
    name: 'Pro Educator',
    price: 29.99,
    currency: 'USD',
    credits: 5000,
    features: [
      '5,000 Credits / month',
      'Custom Agent Voices & Personas',
      'Document & PDF Course Builder',
      'Ultra-HD Media & Audio Generation',
      '24/7 Dedicated Support',
    ],
  },
];

export async function GET() {
  return NextResponse.json({ plans: SUBSCRIPTION_PLANS });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Please sign in to subscribe' }, { status: 401 });
    }

    const dbUser = await findUserByEmail(session.user.email);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { planId } = body;

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    // Apply subscription tier & award plan credits
    const updatedUser = await updateSubscription(dbUser.id, plan.id, plan.credits);

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${plan.name}!`,
      tier: updatedUser.subscription_tier,
      credits: updatedUser.credits,
    });
  } catch (error) {
    console.error('Subscription upgrade error:', error);
    return NextResponse.json({ error: 'Failed to process subscription' }, { status: 500 });
  }
}

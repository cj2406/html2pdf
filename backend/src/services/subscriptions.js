function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  if (!subscription.currentPeriodEnd) return true;
  return new Date(subscription.currentPeriodEnd) >= new Date();
}

async function replaceActiveSubscription(prismaClient, { userId, planId, provider, currentPeriodEnd }) {
  return prismaClient.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'cancelled' },
    });

    return tx.subscription.create({
      data: {
        userId,
        planId,
        status: 'active',
        provider,
        currentPeriodEnd,
      },
    });
  });
}

module.exports = { isSubscriptionActive, replaceActiveSubscription };

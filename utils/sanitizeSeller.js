module.exports = function sanitizeSeller(seller) {
  if (!seller) return null;

  return {
    _id: seller._id,
    user: seller.user,
    sellerCode: seller.sellerCode,

    bio: seller.bio,
    level: seller.level,
    skills: seller.skills,

    earnings: seller.earnings,
    pendingEarnings: seller.pendingEarnings,
    withdrawnEarnings: seller.withdrawnEarnings,

    totalActiveProducts: seller.totalActiveProducts,
    totalDraftProducts: seller.totalDraftProducts,

    totalSales: seller.totalSales,
    activeSales: seller.activeSales,
    completedSales: seller.completedSales,

    totalDownloads: seller.totalDownloads,
    totalCustomers: seller.totalCustomers,

    averageRating: seller.averageRating,

    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
  };
};
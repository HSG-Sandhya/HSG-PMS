// Pure data transforms for the dashboard charts (kept out of the component so
// they're easy to read/test; the component still memoizes the results).

// Adds an INR-formatted revenue string to each revenue datapoint.
export const formatRevenueData = (revenueData) =>
  revenueData.map((item) => ({
    ...item,
    formattedRevenue: new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(item.revenue),
  }));

// Counts guests by gender into the { name, value } shape the pie chart expects.
export const genderDistribution = (guestList) => {
  const counts = { Male: 0, Female: 0, Other: 0 };
  guestList.forEach((g) => {
    const gender = (g.gender || '').toLowerCase();
    if (gender === 'male') { counts.Male++; }
    else if (gender === 'female') { counts.Female++; }
    else { counts.Other++; }
  });
  return [
    { name: 'Male', value: counts.Male },
    { name: 'Female', value: counts.Female },
    { name: 'Other', value: counts.Other },
  ];
};

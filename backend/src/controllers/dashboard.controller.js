const dashboardService = require('../services/dashboardService');

async function get(req, res, next) {
  try {
    const metrics = await dashboardService.getMetrics(req.user);
    res.json(metrics);
  } catch (err) { next(err); }
}

module.exports = { get };

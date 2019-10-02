function hasLaunchForCourse(req, res, next) {
  var courseId = req.params.course;
  if (req.session.launches && req.session.launches[courseId]) {
    next();
  } else {
    res.send(403);
  }
}

module.exports = hasLaunchForCourse;

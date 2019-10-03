(async () => {
  const hideSpinner = () => {
    const spinner = document.getElementById('spinner');
    spinner.classList += 'hidden';
  };
  try {
    const courseId = window.COURSE_ROSTER_PHOTOS.courseId;
    const response = await fetch(`/${courseId}`);
    const responseBody = await response.text();

    hideSpinner();
    const el = document.getElementById('rosterGrid');
    el.innerHTML = responseBody;
  } catch (error) {
    hideSpinner();
    const el = document.getElementById('error');
    el.innerHTML =
      '<p>Sorry, there was a problem retrieving the roster photos for this course. If this issue presists, please quit your browser and try again.</p>';
  }
})();

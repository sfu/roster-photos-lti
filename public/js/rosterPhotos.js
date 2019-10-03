const courseId = window.COURSE_ROSTER_PHOTOS.courseId;

fetch(`/${courseId}`)
  .then(response => {
    return response.text();
  })
  .then(html => {
    const el = document.getElementById('rosterGrid');
    el.innerHTML = html;
  })
  .then(console.log);

// $.ajax({
//   url: url,
//   beforeSend: function() {
//     timer = window.setTimeout(showTimeoutMessage, 4000);
//   },
//   success: function(html) {
//     clearTimeout(timer);
//     $('.timeoutMessage').remove();
//     spinner.stop();
//     target.append(html);
//     parent.postMessage(
//       JSON.stringify({
//         subject: 'lti.frameResize',
//         height: $(document).height() + 'px',
//       }),
//       '*'
//     );
//   },
//   error: function(xhr, status, error) {
//     clearTimeout(timer);
//     $('.timeoutMessage').remove();
//     spinner.stop();
//     target.append(
//       '<p>Sorry, there was a problem retrieving the roster photos for this course. If this issue presists, please quit your browser and try again.</p>'
//     );
//   },
// });

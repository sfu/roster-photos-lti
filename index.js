const https = require('https');
const url = require('url');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const redis = require('redis');
const RedisStore = require('connect-redis')(session);
const axios = require('axios').default;
const LTI = require('ims-lti');
const RedisNonceStore = require('ims-lti/lib/redis-nonce-store');
const hasLaunchForCourse = require('./lib/hasLaunchForCourse');

const {
  HTTP_PORT = 3000,
  REDIS_URL,
  LTI_SECRET,
  SESSION_SECRET,
  CANVAS_API_KEY,
} = process.env;

const redisClient = redis.createClient({ url: REDIS_URL });
const nonceStore = new RedisNonceStore('rosterphotos', redisClient);
const ltiProvider = new LTI.Provider('rosterphotos', LTI_SECRET, nonceStore);

const app = express();
app.set('trust proxy', 1);
app.use(bodyParser.urlencoded());
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true },
  })
);
app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Roster Photos LTI\n');
});

app.post('/launch', (req, res) => {
  console.log(req.body);
  ltiProvider.valid_request(req, function(err, isValid) {
    if (err) {
      console.log(err, req.body);
      res.status(500).send(err);
    } else if (!isValid) {
      // TODO redirect to a proper unauthorized page
      res.status(403);
    } else {
      let courseId = ltiProvider.body.custom_canvas_course_id;
      req.session.launches = req.session.launches || {};
      req.session.launches[courseId] = ltiProvider.body;
      // req.session.launches[courseId].body = provider.body;
      res.render('index', {
        course: ltiProvider.body,
        title: 'Course Roster',
      });
    }
  });
});

app.get('/:course', hasLaunchForCourse, async (req, res) => {
  const launchData = req.session.launches[req.params.course];
  const parsedUrl = url.parse(launchData.launch_presentation_return_url);
  const courseId = launchData.custom_canvas_course_id;
  const apiUrl = `${parsedUrl.protocol}//${parsedUrl.host}/api/v1/courses/${courseId}/users`;
  const params = {
    enrollment_type: 'student',
    per_page: '3000',
  };

  try {
    const instance = axios.create({
      headers: {
        Authorization: `Bearer ${CANVAS_API_KEY}`,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    const result = await instance.get(apiUrl, {
      params,
    });
    console.log(result);
    res.status(200).send(result.data);
  } catch (error) {
    console.log(error);
    res.status(500).send('oops');
  }

  // request(
  //   {
  //     uri: apiUrl,
  //     qs: queryParams,
  //     method: 'GET',
  //     json: true,
  //     headers: {
  //       Authorization: 'Bearer ' + config.canvasApiKey,
  //     },
  //   },
  //   function(err, response, roster) {
  //     if (err) {
  //       console.log(err);
  //       res.render('500', { title: '500' });
  //     }
  //     if (!roster || !roster.length) {
  //       res.render(path.join(__dirname, 'views/no_students'), {
  //         layout: false,
  //       });
  //       return false;
  //     }
  //     let sfuIds = roster.map(function(user) {
  //       return user.sis_user_id;
  //     });
  //     photoClient
  //       .getPhoto(sfuIds)
  //       .then(function(photos) {
  //         // ids that don't have photos will be undefined in the photos array
  //         // replace with placeholder data

  //         if (!photos || !photos.length) {
  //           res.render('500', { title: '500' });
  //           return false;
  //         }

  //         let normalizedPhotos = photos.map(function(photo, index) {
  //           if (!photo) {
  //             let name = roster[index].sortable_name.split(', ');
  //             photo = {
  //               LastName: name[0],
  //               FirstName: name[1],
  //               SfuId: roster[index].sis_user_id,
  //               PictureIdentification: noPhotoImage,
  //             };
  //           }
  //           photo.canvasProfileUrl =
  //             parsedUrl.protocol +
  //             '//' +
  //             parsedUrl.host +
  //             '/courses/' +
  //             courseId +
  //             '/users/' +
  //             roster[index].id;
  //           return photo;
  //         });

  //         let rows = [],
  //           maxPerRow = 4;
  //         for (let i = 0, j = normalizedPhotos.length; i < j; i += maxPerRow) {
  //           rows.push(normalizedPhotos.slice(i, i + maxPerRow));
  //         }
  //         res.render(path.join(__dirname, 'views/row'), {
  //           rows: rows,
  //           layout: false,
  //         });
  //       })
  //       .fail(function(err) {
  //         res.render('500', { title: '500' });
  //       });
  //   }
  // );
});

app.listen(HTTP_PORT);
console.log(`Listening on ${HTTP_PORT}`);
